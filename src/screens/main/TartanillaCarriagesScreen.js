import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { apiBaseUrl } from '../../services/networkConfig';
import driverService from '../../services/carriages/fetchDriver';

import { supabase } from '../../services/supabase';
import { getMyCarriages, assignDriverToCarriage, createCarriage } from '../../services/tartanillaService';
import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');
const MAROON = '#6B2E2B';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333';

export default function TartanillaCarriagesScreen({ navigation }) {
  const auth = useAuth();
  const [carriages, setCarriages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [newCarriage, setNewCarriage] = useState({
    plate_number: '', 
    capacity: '4',
    status: 'available',
    notes: ''
  });
  const [addingCarriage, setAddingCarriage] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [currentApiUrl, setCurrentApiUrl] = useState('');
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedCarriage, setSelectedCarriage] = useState(null);
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [driverCache, setDriverCache] = useState({}); // id -> driver details

  // All callback functions need to be defined before the conditional return
  const fetchAllDrivers = async () => {
    try {
      const drivers = await driverService.getAllDrivers();
      const list = Array.isArray(drivers) ? drivers : [];
      setAvailableDrivers(list);
      // Seed cache by id and user_id for immediate resolution in cards
      if (list.length) {
        const updates = {};
        list.forEach(d => {
          if (d?.id) updates[String(d.id)] = d;
          if (d?.user_id) updates[String(d.user_id)] = d;
        });
        if (Object.keys(updates).length) {
          setDriverCache(prev => ({ ...prev, ...updates }));
        }
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      Alert.alert('Error', error.message || 'Failed to load drivers');
    }
  };

  const handleAssignDriver = async (driver) => {
    if (!selectedCarriage || !driver?.id) return;
    
    setAssigningDriver(true);
    try {
      const result = await assignDriverToCarriage(selectedCarriage.id, driver.id);
      
      if (result.success) {
        // Optimistically seed the cache so UI shows name/email immediately
        setDriverCache(prev => ({ ...prev, [driver.id]: driver }));
        // Optionally update the specific carriage locally for instant feedback
        setCarriages(prev => prev.map(c => c.id === selectedCarriage.id 
          ? { ...c, assigned_driver_id: driver.id, assigned_driver: c.assigned_driver || null }
          : c
        ));
        setShowDriverModal(false);
        Alert.alert('Success', 'Driver invitation sent! Waiting for driver acceptance.', [
          {
            text: 'OK',
            onPress: async () => {
              // Force refresh the carriages list
              await fetchUserAndCarriages();
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to assign driver');
      }
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver');
    } finally {
      setAssigningDriver(false);
    }
  };

  const openDriverModal = async (carriage) => {
    setSelectedCarriage(carriage);
    setShowDriverModal(true);
    await fetchAllDrivers();
  };

  const fetchUserAndCarriages = useCallback(async () => {
    try {
      setLoading(true);

      // Use the authenticated user from auth hook
      const currentUser = auth.user;
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view your carriages');
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Only owners should see their carriages
      const role = currentUser.role;
      if (role !== 'owner') {
        setCarriages([]);
        setLoading(false);
        return;
      }

      const result = await getMyCarriages();
      if (result.success) {
        console.log('Raw carriage data:', result.data);
        setCarriages(result.data || []);
      } else {
        console.error('Error loading carriages:', result.error);
        setCarriages([]);
      }
    } catch (err) {
      console.error('Failed to load carriages:', err);
      let errorMessage = 'Failed to load carriages';
      
      if (err.message.includes('Network request failed')) {
        errorMessage = 'Network error: Please check your internet connection and ensure the server is running at http://192.168.101.80:8000';
      } else if (err.message.includes('HTTP error')) {
        errorMessage = `Server error: ${err.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [auth.user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (auth.user?.role === 'owner') {
        const result = await getMyCarriages();
        if (result.success) {
          setCarriages(result.data || []);
        }
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [auth.user]);

  useEffect(() => {
    // Handle authentication redirect
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
      return;
    }
    
    // Load data when authenticated
    if (auth.isAuthenticated) {
      fetchUserAndCarriages();
    }
  }, [auth.loading, auth.isAuthenticated, fetchUserAndCarriages, navigation]);

  // When carriages change, hydrate missing driver details into a local cache
  useEffect(() => {
    const fetchMissingDrivers = async () => {
      try {
        const idsToFetch = (carriages || [])
          .map(c => c.assigned_driver ? null : c.assigned_driver_id)
          .filter(id => !!id && !driverCache[id]);

        if (idsToFetch.length === 0) return;

        let unresolved = new Set(idsToFetch);

        // First, try per-ID fetches
        for (const id of idsToFetch) {
          try {
            const d = await driverService.getDriverById(id);
            if (d) {
              setDriverCache(prev => ({ ...prev, [id]: d }));
              unresolved.delete(id);
            }
          } catch (e) {
            // will try bulk fallback below
          }
        }

        // Bulk fallback if any unresolved
        if (unresolved.size > 0) {
          try {
            const all = await driverService.getAllDrivers();
            const byId = new Map();
            const byUserId = new Map();
            (Array.isArray(all) ? all : []).forEach(d => {
              if (d?.id) byId.set(String(d.id), d);
              if (d?.user_id) byUserId.set(String(d.user_id), d);
            });

            const updates = {};
            unresolved.forEach(id => {
              const key = String(id);
              const d = byId.get(key) || byUserId.get(key);
              if (d) updates[key] = d;
            });
            if (Object.keys(updates).length > 0) {
              setDriverCache(prev => ({ ...prev, ...updates }));
            }
          } catch (e) {
            // swallow; not critical for UI
          }
        }
      } catch (e) {
        // ignore
      }
    };
    fetchMissingDrivers();
  }, [carriages, driverCache]);

  // Show loading while checking authentication
  if (auth.loading) {
    return (
      <View style={styles.container}>
        <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!auth.isAuthenticated) {
    return null;
  }

  const testConnection = async () => {
    try {
      setConnectionStatus('Testing...');
      const result = await testCarriageConnection();
      setConnectionStatus(result);
      
      if (result.success) {
        // Update the API base URL to the working endpoint
        const workingUrl = result.url;
        setApiBaseUrl(workingUrl);
        setCurrentApiUrl(workingUrl);
        
        Alert.alert(
          'Connection Test', 
          `Success! Found working endpoint: ${workingUrl}\n\nAPI URL has been updated automatically.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh the data with the new URL
                fetchUserAndCarriages();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Connection Test', 
          `Failed to connect. Error: ${result.error}\n\nPlease check:\n1. Django server is running\n2. URL patterns in urls.py\n3. ViewSet is properly registered`,
          [
            {
              text: 'Show Tested URLs',
              onPress: () => {
                Alert.alert('Tested URLs', result.testedUrls.join('\n'));
              }
            },
            { text: 'OK' }
          ]
        );
      }
    } catch (error) {
      setConnectionStatus({ success: false, error: error.message });
      Alert.alert('Connection Test', `Error: ${error.message}`);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!newCarriage.plate_number.trim()) {
      errors.plate_number = 'Plate number is required';
    } else if (!/^[A-Z0-9-]+$/i.test(newCarriage.plate_number)) {
      errors.plate_number = 'Enter a valid plate number';
    }
    
    const capacity = parseInt(newCarriage.capacity);
    if (isNaN(capacity) || capacity < 1 || capacity > 10) {
      errors.capacity = 'Capacity must be between 1 and 10';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCarriage = async () => {
    if (!validateForm()) {
      return;
    }

    setAddingCarriage(true);
    try {
      // Format the data exactly as the API expects it
      const carriageData = {
        plate_number: newCarriage.plate_number.trim(),
        capacity: parseInt(newCarriage.capacity) || 4,
        status: newCarriage.status || 'available',
        eligibility: newCarriage.eligibility || 'eligible',
        notes: newCarriage.notes || ''
      };
      
      // Remove any empty fields
      Object.keys(carriageData).forEach(key => {
        if (carriageData[key] === '' || carriageData[key] === null || carriageData[key] === undefined) {
          delete carriageData[key];
        }
      });

      console.log('Creating carriage with data:', carriageData);
      
      // First, check if a carriage with this plate number already exists
      const existingResult = await getMyCarriages();
      const existingCarriages = existingResult.success ? existingResult.data : [];
      const duplicate = Array.isArray(existingCarriages) && 
        existingCarriages.some(carriage => 
          carriage.plate_number?.toLowerCase() === carriageData.plate_number?.toLowerCase()
        );
      
      if (duplicate) {
        Alert.alert('Error', 'A carriage with this plate number already exists');
        setAddingCarriage(false);
        return;
      }

      // Use the service function
      const result = await createCarriage(carriageData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add carriage');
      }

      // Reset form and close modal on success
      setShowAddModal(false);
      setNewCarriage({
        plate_number: '',
        capacity: '4',
        status: 'available',
        notes: ''
      });
      
      // Show success message
      Alert.alert('Success', 'Carriage added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Refresh the list after a short delay to ensure the modal is closed
            setTimeout(() => fetchUserAndCarriages(), 100);
          }
        }
      ]);
    } catch (error) {
      console.error('Error adding carriage:', error);
      
      // Check for authentication errors
      if (error.message.includes('Owner not found') || error.message.includes('not authenticated')) {
        Alert.alert('Session Expired', 'Please log in again.', [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            }
          }
        ]);
        return;
      }
      
      let errorMessage = 'Failed to add carriage. Please try again.';
      
      if (error.message.includes('plate_number')) {
        errorMessage = 'Invalid plate number format. Please check and try again.';
      } else if (error.message.includes('status')) {
        errorMessage = 'Invalid status value. Please select a valid status.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Invalid data. Please check all fields and try again.';
      } else if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setAddingCarriage(false);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="car-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Carriages Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        {auth.user?.role === 'owner'
          ? 'You have not registered any tartanilla carriages yet.'
          : 'Only owners can view their tartanilla carriages.'}
      </Text>
      {auth.user?.role === 'owner' && (
        <TouchableOpacity style={styles.testConnectionButton} onPress={testConnection}>
          <Text style={styles.testConnectionButtonText}>Test API Connection</Text>
        </TouchableOpacity>
      )}
      
      {loading && <ActivityIndicator size="large" color={MAROON} style={{marginTop: 20}} />}
    </View>
  );

  const getStatusTextStyle = (status) => {
    switch (status) {
      case 'available':
        return { color: '#28a745' };
      case 'in_use':
        return { color: '#dc3545' };
      case 'maintenance':
        return { color: '#ffc107' };
      default:
        return { color: DARK_GRAY };
    }
  };

  const renderCarriageCard = (carriage) => {
    const statusConfig = {
      available: { 
        icon: 'checkmark-circle', 
        color: '#28a745',
        bgColor: '#E8F5E9',
        text: 'Available',
        iconColor: '#28a745'
      },
      in_use: { 
        icon: 'time', 
        color: '#dc3545',
        bgColor: '#FFEBEE',
        text: 'In Use',
        iconColor: '#dc3545'
      },
      maintenance: { 
        icon: 'build', 
        color: '#ffc107',
        bgColor: '#FFF8E1',
        text: 'Maintenance',
        iconColor: '#ff8f00'
      },
      waiting_driver_acceptance: {
        icon: 'hourglass-outline',
        color: '#ff8f00',
        bgColor: '#FFF3E0',
        text: 'Pending Driver',
        iconColor: '#ff8f00'
      },
      driver_assigned: {
        icon: 'person-circle',
        color: '#2196F3',
        bgColor: '#E3F2FD',
        text: 'Driver Assigned',
        iconColor: '#2196F3'
      },
      default: {
        icon: 'help-circle',
        color: '#6c757d',
        bgColor: '#f5f5f5',
        text: 'Unknown',
        iconColor: '#6c757d'
      }
    };

    const status = statusConfig[carriage.status?.toLowerCase()] || statusConfig.default;
    
    // Debug: Log the actual carriage data structure
    console.log('Carriage debug:', {
      plate: carriage.plate_number,
      driver_id: carriage.assigned_driver_id,
      driver_obj: carriage.assigned_driver,
      status: carriage.status
    });
    
    const cached = driverCache[carriage.assigned_driver_id];

    // Build driver name with multiple fallbacks
    const buildName = (d) => {
      if (!d) return null;
      return (
        d.name ||
        d.full_name || d.fullName ||
        (d.first_name || d.last_name ? `${d.first_name || ''} ${d.last_name || ''}`.trim() : null) ||
        // nested user object fallback
        d.user?.name ||
        (d.user && (d.user.first_name || d.user.last_name) ? `${d.user.first_name || ''} ${d.user.last_name || ''}`.trim() : null) ||
        d.username ||
        // last resort: use email or its local-part
        d.email || (typeof d.email === 'string' ? d.email : null) ||
        null
      );
    };

    const driverName =
      buildName(carriage.assigned_driver) ||
      buildName(cached) ||
      (carriage.assigned_driver_id ? 'Unknown Driver' : 'Unassigned');

    // Driver email
    const driverEmail =
      carriage.assigned_driver?.email ||
      cached?.email ||
      (carriage.assigned_driver_id ? 'No email' : '');

    
    // Show assignment status for owners
    const assignmentStatus = carriage.status === 'waiting_driver_acceptance'
      ? 'Waiting for driver acceptance'
      : carriage.status === 'driver_assigned'
      ? 'Driver confirmed assignment'
      : null;

    return (
      <View key={carriage.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.plateContainer}>
            <Ionicons name="car" size={20} color={MAROON} style={styles.carIcon} />
            <Text style={styles.plateNumber}>{carriage.plate_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon} size={14} color={status.iconColor} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.text}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color="#555" style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Driver</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{driverName}</Text>
              {driverEmail && (
                <Text style={[styles.infoLabel, { marginTop: 2, fontSize: 11, color: '#888' }]} numberOfLines={1}>{driverEmail}</Text>
              )}
            </View>
            {carriage.status !== 'driver_assigned' && (
              <TouchableOpacity 
                style={[styles.assignButton, { opacity: assigningDriver ? 0.6 : 1 }]}
                onPress={() => openDriverModal(carriage)}
                disabled={assigningDriver}
              >
                <Ionicons 
                  name={carriage.assigned_driver || carriage.status === 'waiting_driver_acceptance' ? "sync-outline" : "person-add"} 
                  size={14} 
                  color="#fff"
                />
                <Text style={styles.assignButtonText}>
                  {(carriage.assigned_driver || carriage.status === 'waiting_driver_acceptance') ? 'Change' : 'Assign'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="people" size={16} color="#555" style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Capacity</Text>
              <Text style={styles.infoValue}>{carriage.capacity || 'N/A'} persons</Text>
            </View>
          </View>

          {carriage.eligibility && (
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark" size={16} color="#555" style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Eligibility</Text>
                <Text style={styles.infoValue}>
                  {carriage.eligibility.charAt(0).toUpperCase() + carriage.eligibility.slice(1)}
                </Text>
              </View>
            </View>
          )}

          {assignmentStatus && (
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={16} color="#ff8f00" style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Assignment Status</Text>
                <Text style={[styles.infoValue, { color: '#ff8f00' }]}>
                  {assignmentStatus}
                </Text>
              </View>
            </View>
          )}

          {carriage.notes && (
            <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text" size={16} color="#555" style={[styles.infoIcon, { marginTop: 2 }]} />
              <View style={[styles.infoTextContainer, { flex: 1 }]}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={2}>
                  {carriage.notes}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDriverModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showDriverModal}
      onRequestClose={() => !assigningDriver && setShowDriverModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Driver</Text>
            <TouchableOpacity 
              onPress={() => !assigningDriver && setShowDriverModal(false)}
              disabled={assigningDriver}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            {availableDrivers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No drivers found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Try again later.
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableDrivers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.driverItem, assigningDriver && styles.driverItemDisabled]}
                    onPress={() => handleAssignDriver(item)}
                    disabled={assigningDriver}
                    activeOpacity={0.7}
                  >
                    <View style={styles.driverAvatar}>
                      <Ionicons name="person-circle-outline" size={40} color={MAROON} />
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>
                        {(
                          item.name ||
                          item.full_name || item.fullName ||
                          (item.first_name || item.last_name ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : null) ||
                          item.user?.name ||
                          (item.user && (item.user.first_name || item.user.last_name) ? `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim() : null) ||
                          item.username ||
                          item.email ||
                          'Unknown Driver'
                        )}
                      </Text>
                      <Text style={styles.driverEmail} numberOfLines={1}>
                        {item.email || 'No email'}
                      </Text>
                      <Text style={styles.driverRole}>
                        {item.role || 'driver'}
                      </Text>
                    </View>
                    <View style={styles.selectDriverButton}>
                      <Ionicons name="chevron-forward" size={20} color={MAROON} />
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.divider} />}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
  

  // Main render function
  return (
    <View style={styles.container}>
      <TARTRACKHeader
        title="My Tartanilla Carriages"
        onNotificationPress={() => navigation.navigate('NotificationScreen')} 
      />
      
      <View style={styles.headerContainer}>
        <Text style={styles.heading}>Carriage Management</Text>
        <Text style={styles.subheading}>Manage your tartanilla carriages and drivers</Text>
      </View>
      
      {/* Driver Assignment Modal */}
      {renderDriverModal()}
      
      {user?.role === 'owner' && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          {/* <Text style={styles.addButtonText}>Add Carriage</Text> */}
        </TouchableOpacity>
      )}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MAROON} />
          <Text style={styles.loadingText}>Loading carriages...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.scrollViewContent}
        >
          {carriages.length === 0 ? (
            renderEmptyState()
          ) : (
            carriages.map((carriage) => renderCarriageCard(carriage))
          )}
        </ScrollView>
      )}
      
      {/* Add Carriage Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddModal}
        onRequestClose={() => !addingCarriage && setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Carriage</Text>
              <TouchableOpacity 
                onPress={() => !addingCarriage && setShowAddModal(false)}
                disabled={addingCarriage}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Plate Number *</Text>
                <TextInput
                  style={[styles.input, formErrors.plate_number && styles.inputError]}
                  placeholder="e.g., ABC 123"
                  value={newCarriage.plate_number}
                  onChangeText={(text) => setNewCarriage({...newCarriage, plate_number: text})}
                  editable={!addingCarriage}
                />
                {formErrors.plate_number && (
                  <Text style={styles.errorText}>{formErrors.plate_number}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Capacity *</Text>
                <View style={styles.capacityContainer}>
                  <TouchableOpacity 
                    style={styles.capacityButton}
                    onPress={() => {
                      const newCapacity = Math.max(1, (parseInt(newCarriage.capacity) || 4) - 1);
                      setNewCarriage({...newCarriage, capacity: newCapacity.toString()});
                    }}
                    disabled={addingCarriage}
                  >
                    <Ionicons name="remove" size={20} color="#666" />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={[styles.input, styles.capacityInput]}
                    value={newCarriage.capacity}
                    onChangeText={(text) => setNewCarriage({...newCarriage, capacity: text})}
                    keyboardType="numeric"
                    editable={!addingCarriage}
                  />
                  
                  <TouchableOpacity 
                    style={styles.capacityButton}
                    onPress={() => {
                      const newCapacity = Math.min(10, (parseInt(newCarriage.capacity) || 4) + 1);
                      setNewCarriage({...newCarriage, capacity: newCapacity.toString()});
                    }}
                    disabled={addingCarriage}
                  >
                    <Ionicons name="add" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                {formErrors.capacity && (
                  <Text style={styles.errorText}>{formErrors.capacity}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.statusOptions}>
                  {['available', 'in_use', 'maintenance'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        newCarriage.status === status && styles.statusOptionSelected,
                        { backgroundColor: statusConfig[status]?.bgColor || '#f5f5f5' }
                      ]}
                      onPress={() => setNewCarriage({...newCarriage, status})}
                      disabled={addingCarriage}
                    >
                      <Ionicons 
                        name={statusConfig[status]?.icon || 'help-circle'} 
                        size={16} 
                        color={statusConfig[status]?.color || '#666'} 
                        style={styles.statusIcon} 
                      />
                      <Text style={[
                        styles.statusOptionText,
                        { color: statusConfig[status]?.color || '#666' },
                        newCarriage.status === status && styles.statusOptionTextSelected
                      ]}>
                        {statusConfig[status]?.text || 'Unknown'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>



              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any additional notes about this carriage"
                  value={newCarriage.notes}
                  onChangeText={(text) => setNewCarriage({...newCarriage, notes: text})}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!addingCarriage}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, addingCarriage && styles.buttonDisabled]}
                onPress={() => setShowAddModal(false)}
                disabled={addingCarriage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, addingCarriage && styles.buttonDisabled]}
                onPress={handleAddCarriage}
                disabled={addingCarriage}
              >
                {addingCarriage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Carriage</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Driver Assignment Modal */}
      {renderDriverModal()}
    </View>
  );
}

// Status configuration
const statusConfig = {
  available: { 
    icon: 'checkmark-circle', 
    color: '#28a745',
    bgColor: '#E8F5E9',
    text: 'Available',
  },
  in_use: { 
    icon: 'time', 
    color: '#dc3545',
    bgColor: '#FFEBEE',
    text: 'In Use',
  },
  maintenance: { 
    icon: 'build', 
    color: '#ff8f00',
    bgColor: '#FFF8E1',
    text: 'Maintenance',
  },
  waiting_driver_acceptance: {
    icon: 'hourglass-outline',
    color: '#ff8f00',
    bgColor: '#FFF3E0',
    text: 'Pending Driver',
  },
  driver_assigned: {
    icon: 'person-circle',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    text: 'Driver Assigned',
  },
  default: {
    icon: 'help-circle',
    color: '#6c757d',
    bgColor: '#f5f5f5',
    text: 'Unknown',
  }
};

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: MAROON,
  },
  modalBody: {
    padding: 16,
    maxHeight: '70%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  
  // Form Styles
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityButton: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  capacityInput: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  statusOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statusOptionSelected: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  statusIcon: {
    marginRight: 6,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusOptionTextSelected: {
    fontWeight: '600',
  },
  eligibilityContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  eligibilityOption: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  eligibilityOptionSelected: {
    backgroundColor: MAROON,
  },
  eligibilityOptionText: {
    color: '#555',
    fontWeight: '500',
  },
  eligibilityOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    minWidth: 100,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: MAROON,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Header Styles
  headerContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: MAROON,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: '#666',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carIcon: {
    marginRight: 8,
  },
  plateNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    paddingTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    width: 24,
    textAlign: 'center',
    marginRight: 8,
  },
  infoTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: MAROON,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  // ... existing styles ...
  
  // Driver Section
  driverSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  driverLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  buttonIcon: {
    marginRight: 4,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: MAROON,
  },
  modalBody: {
    padding: 0,
  },
  driverItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  driverPhone: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 68,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  // ... (rest of the styles remain the same)
  driverSection: {
    marginTop: 10,
    paddingTop: 10,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverLabel: {
    fontSize: 14,
    color: '#555',
  },
  assignButton: {
    backgroundColor: MAROON,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  // Driver Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: MAROON,
  },
  modalBody: {
    padding: 0,
  },
  driverItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  driverEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  driverPhone: {
    fontSize: 13,
    color: '#888',
  },
  driverRole: {
    fontSize: 12,
    color: MAROON,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  driverItemDisabled: {
    opacity: 0.6,
  },
  selectDriverButton: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 68,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_GRAY,
    marginLeft: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 2,
  },
  rowText: {
    color: '#444',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  statusOptionSelected: {
    backgroundColor: MAROON,
    borderColor: MAROON,
  },
  statusOptionText: {
    fontSize: 14,
    color: '#666',
  },
  statusOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: MAROON,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
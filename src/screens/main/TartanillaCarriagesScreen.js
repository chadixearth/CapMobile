import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import driverService from '../../services/carriages/fetchDriver';
import { apiBaseUrl } from '../../services/networkConfig';

import { supabase } from '../../services/supabase';
import { getMyCarriages, assignDriverToCarriage, createCarriage } from '../../services/tartanillaService';
import { useAuth } from '../../hooks/useAuth';
import carriageService from '../../services/tourpackage/fetchCarriage';

const { width } = Dimensions.get('window');
const MAROON = '#6B2E2B';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333';

export default function TartanillaCarriagesScreen({ navigation }) {
  const auth = useAuth();
  const [carriages, setCarriages] = useState([]);
  
  // Debug effect to track carriages state changes
  useEffect(() => {
    console.log('=== CARRIAGES STATE CHANGED ===');
    console.log('Carriages state:', carriages);
    console.log('Carriages length:', carriages.length);
    console.log('Is array:', Array.isArray(carriages));
    console.log('First carriage:', carriages[0]);
    console.log('================================');
  }, [carriages]);

  // Debug render - only in development
  if (__DEV__) {
    console.log('RENDER DEBUG - Loading:', loading, 'Auth loading:', auth.loading, 'Authenticated:', auth.isAuthenticated);
  }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [newCarriage, setNewCarriage] = useState({
    plate_number: '', 
    capacity: '4',
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCarriage, setEditingCarriage] = useState(null);
  const [editForm, setEditForm] = useState({ capacity: '4', status: 'available', notes: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const normalizedStatusRef = useRef(new Set()); // ids already normalized from driver_assigned -> available

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
        // Optimistically seed the cache so UI shows name/email immediately (by id and user_id)
        setDriverCache(prev => ({ 
          ...prev, 
          [String(driver.id)]: driver,
          ...(driver.user_id ? { [String(driver.user_id)]: driver } : {})
        }));
        // Optimistically update the specific carriage locally for instant feedback
        setCarriages(prev => prev.map(c => c.id === selectedCarriage.id 
          ? { 
              ...c, 
              assigned_driver_id: driver.id,
              assigned_driver: driver,
              status: 'waiting_driver_acceptance'
            }
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

      // Show carriages based on role
      const role = currentUser.role;
      if (role !== 'owner' && role !== 'driver' && role !== 'driver-owner') {
        setCarriages([]);
        setLoading(false);
        return;
      }

      const result = await getMyCarriages();
      console.log('getMyCarriages result:', result);
      if (result.success) {
        const carriageData = result.data || [];
        console.log('About to set carriages state with:', carriageData);
        console.log('Carriages array length:', carriageData.length);
        console.log('Carriages array type:', Array.isArray(carriageData));
        console.log('First carriage data:', carriageData[0]);
        
        // Force state update with a new array reference
        const newCarriages = Array.isArray(carriageData) ? [...carriageData] : [];
        setCarriages(newCarriages);
        console.log('setCarriages called with:', newCarriages.length, 'items');
        
        // Force a re-render by updating loading state
        setTimeout(() => {
          console.log('Current carriages state after timeout:', carriages.length);
        }, 100);
      } else {
        console.error('Error loading carriages:', result.error);
        setCarriages([]);
      }
    } catch (err) {
      console.error('Failed to load carriages:', err);
      let errorMessage = 'Failed to load carriages';
      
      if (err.message.includes('Network request failed')) {
        errorMessage = `Network error: Please check your internet connection and ensure the server is running at ${apiBaseUrl().replace('/api', '')}`;
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
      if (auth.user?.role === 'owner' || auth.user?.role === 'driver' || auth.user?.role === 'driver-owner') {
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

  // Normalize backend status: convert 'driver_assigned' to 'available' once per carriage
  useEffect(() => {
    (async () => {
      try {
        const items = Array.isArray(carriages) ? carriages : [];
        const toNormalize = items.filter(c => c?.id && c.status === 'driver_assigned' && !normalizedStatusRef.current.has(c.id));
        for (const c of toNormalize) {
          try {
            await carriageService.updateCarriage(c.id, { status: 'available' });
            normalizedStatusRef.current.add(c.id);
            // Optimistically update local state
            setCarriages(prev => prev.map(x => x.id === c.id ? { ...x, status: 'available' } : x));
          } catch (e) {
            // Skip failures but don't loop endlessly
            normalizedStatusRef.current.add(c.id);
          }
        }
      } catch (_) {
        // ignore
      }
    })();
  }, [carriages]);

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
        // Update the current API URL for display
        const workingUrl = result.url;
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
        status: 'available', // New carriages should be available for rent
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

  const openEditModal = (carriage) => {
    setEditingCarriage(carriage);
    setEditForm({
      capacity: String(carriage.capacity || '4'),
      status: (carriage.status && carriage.status !== 'driver_assigned') ? carriage.status : 'available',
      notes: carriage.notes || ''
    });
    setShowEditModal(true);
  };

  const validateEditForm = () => {
    const errors = {};
    const cap = parseInt(editForm.capacity);
    if (isNaN(cap) || cap < 1 || cap > 10) {
      errors.capacity = 'Capacity must be between 1 and 10';
    }
    if (!editForm.status) {
      errors.status = 'Status is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateCarriage = async () => {
    if (!editingCarriage) return;
    if (!validateEditForm()) return;
    setSavingEdit(true);
    try {
      const updates = {
        capacity: parseInt(editForm.capacity) || undefined,
        status: editForm.status,
        notes: editForm.notes ?? ''
      };
      // Clean undefined
      Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

      await carriageService.updateCarriage(editingCarriage.id, updates);

      setShowEditModal(false);
      setEditingCarriage(null);
      // Refresh
      await fetchUserAndCarriages();
      Alert.alert('Success', 'Carriage updated successfully');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update carriage');
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusIcon = (status) => {
    const statusConfig = {
      available: { icon: 'checkmark-circle', color: '#28a745', bgColor: '#E8F5E9', text: 'Available', iconColor: '#28a745' },
      in_use: { icon: 'time', color: '#dc3545', bgColor: '#FFEBEE', text: 'In Use', iconColor: '#dc3545' },
      maintenance: { icon: 'build', color: '#ffc107', bgColor: '#FFF8E1', text: 'Maintenance', iconColor: '#ff8f00' },
      waiting_driver_acceptance: { icon: 'hourglass-outline', color: '#ff8f00', bgColor: '#FFF3E0', text: 'Pending Driver', iconColor: '#ff8f00' },
      driver_assigned: { icon: 'person-circle', color: '#2196F3', bgColor: '#E3F2FD', text: 'Driver Assigned', iconColor: '#2196F3' },
      not_usable: { icon: 'close-circle', color: '#dc3545', bgColor: '#F5C6CB', text: 'Not Usable', iconColor: '#dc3545' },
      default: { icon: 'help-circle', color: '#6c757d', bgColor: '#f5f5f5', text: 'Unknown', iconColor: '#6c757d' },
    };
    return statusConfig[status] || statusConfig.default;
  };

  const renderCarriageCard = (carriage) => {
    const statusConfig = {
      available: { icon: 'checkmark-circle', color: '#10B981', bgColor: '#ECFDF5', text: 'Available' },
      in_use: { icon: 'time', color: '#EF4444', bgColor: '#FEF2F2', text: 'In Use' },
      maintenance: { icon: 'build', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Maintenance' },
      waiting_driver_acceptance: { icon: 'hourglass-outline', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Awaiting Driver' },
      driver_assigned: { icon: 'person-circle', color: '#3B82F6', bgColor: '#EFF6FF', text: 'Driver Assigned' },
      not_usable: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEF2F2', text: 'Not Usable' },
      suspended: { icon: 'pause-circle', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Suspended' },
      out_of_service: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEF2F2', text: 'Out of Service' },
      default: { icon: 'help-circle', color: '#6B7280', bgColor: '#F9FAFB', text: 'Unknown' },
    };

    const statusKey = carriage.status?.toLowerCase() || 'default';
    const status = statusConfig[statusKey] || statusConfig.default;
    const isDriver = user?.role === 'driver';

    const cached = driverCache[carriage.assigned_driver_id];

    const buildName = (d) => {
      if (!d) return null;
      return (
        d.name ||
        d.full_name || d.fullName ||
        (d.first_name || d.last_name ? `${d.first_name || ''} ${d.last_name || ''}`.trim() : null) ||
        d.user?.name ||
        (d.user && (d.user.first_name || d.user.last_name) ? `${d.user.first_name || ''} ${d.user.last_name || ''}`.trim() : null) ||
        d.username ||
        d.email || (typeof d.email === 'string' ? d.email : null) ||
        null
      );
    };

    const driverName =
      buildName(carriage.assigned_driver) ||
      buildName(cached) ||
      (carriage.assigned_driver_id ? 'Unknown Driver' : 'Unassigned');

    const driverEmail =
      carriage.assigned_driver?.email ||
      cached?.email ||
      (carriage.assigned_driver_id ? 'No email' : '');

    const driverPhone =
      carriage.assigned_driver?.phone ||
      carriage.assigned_driver?.mobile ||
      carriage.assigned_driver?.phone_number ||
      cached?.phone ||
      cached?.mobile ||
      cached?.phone_number ||
      '';

    const driverAddress =
      carriage.assigned_driver?.address ||
      carriage.assigned_driver?.location ||
      cached?.address ||
      cached?.location ||
      '';

    const hasDriverSelected = !!(carriage.assigned_driver_id || carriage.assigned_driver);
    const assignmentStatus = hasDriverSelected && carriage.status === 'waiting_driver_acceptance'
      ? 'Waiting for driver acceptance'
      : null;
    return (
      <View key={carriage.id} style={styles.modernCard}>
        <View style={styles.modernCardHeader}>
          <View style={styles.plateContainer}>
            <View style={styles.plateIconContainer}>
              <Ionicons name="car" size={24} color={MAROON} />
            </View>
            <View style={styles.plateInfo}>
              <Text style={styles.modernPlateNumber}>{carriage.plate_number}</Text>
              <View style={[styles.modernStatusBadge, { backgroundColor: status.bgColor }]}>
                <Ionicons name={status.icon} size={12} color={status.color} />
                <Text style={[styles.modernStatusText, { color: status.color }]}>
                  {status.text}
                </Text>
              </View>
            </View>
          </View>
          {!isDriver && hasDriverSelected && carriage.status !== 'waiting_driver_acceptance' && (
            <TouchableOpacity
              style={styles.modernEditButton}
              onPress={() => openEditModal(carriage)}
              disabled={savingEdit}
            >
              <Ionicons name="pencil" size={16} color={MAROON} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.modernCardContent}>
          <View style={styles.modernInfoGrid}>
            <View style={styles.modernInfoItem}>
              <View style={styles.modernInfoHeader}>
                <Ionicons name="person" size={18} color={MAROON} />
                <Text style={styles.modernInfoLabel}>Driver</Text>
              </View>
              <Text style={styles.modernInfoValue} numberOfLines={1}>{driverName}</Text>
              {driverEmail && (
                <Text style={styles.modernInfoSubtext} numberOfLines={1}>{driverEmail}</Text>
              )}
              {driverPhone && (
                <Text style={styles.modernInfoSubtext} numberOfLines={1}>📱 {driverPhone}</Text>
              )}
              {driverAddress && (
                <Text style={styles.modernInfoSubtext} numberOfLines={1}>📍 {driverAddress}</Text>
              )}
              {!isDriver && (
                <View style={styles.modernActionButtons}>
                  {!hasDriverSelected && (
                    <TouchableOpacity 
                      style={styles.modernAssignButton}
                      onPress={() => openDriverModal(carriage)}
                      disabled={assigningDriver}
                    >
                      <Ionicons name="person-add" size={14} color="#fff" />
                      <Text style={styles.modernButtonText}>Assign</Text>
                    </TouchableOpacity>
                  )}
                  {hasDriverSelected && carriage.status === 'waiting_driver_acceptance' && (
                    <TouchableOpacity 
                      style={styles.modernChangeButton}
                      onPress={() => openDriverModal(carriage)}
                      disabled={assigningDriver}
                    >
                      <Ionicons name="sync-outline" size={14} color="#fff" />
                      <Text style={styles.modernButtonText}>Change</Text>
                    </TouchableOpacity>
                  )}
                  {hasDriverSelected && carriage.status !== 'waiting_driver_acceptance' && (
                    <TouchableOpacity 
                      style={styles.modernReassignButton}
                      onPress={() => openDriverModal(carriage)}
                      disabled={assigningDriver}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#fff" />
                      <Text style={styles.modernButtonText}>Reassign</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <View style={styles.modernInfoItem}>
              <View style={styles.modernInfoHeader}>
                <Ionicons name="people" size={18} color={MAROON} />
                <Text style={styles.modernInfoLabel}>Capacity</Text>
              </View>
              <Text style={styles.modernInfoValue}>{carriage.capacity || 'N/A'} persons</Text>
            </View>
          </View>

          {assignmentStatus && (
            <View style={styles.modernAlertBox}>
              <Ionicons name="information-circle" size={16} color="#F59E0B" />
              <Text style={styles.modernAlertText}>{assignmentStatus}</Text>
            </View>
          )}

          {carriage.notes && (
            <View style={styles.modernNotesSection}>
              <View style={styles.modernInfoHeader}>
                <Ionicons name="document-text" size={16} color={MAROON} />
                <Text style={styles.modernInfoLabel}>Notes</Text>
              </View>
              <Text style={styles.modernNotesText} numberOfLines={2}>
                {carriage.notes}
              </Text>
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
                      {(item.phone || item.mobile || item.phone_number) && (
                        <Text style={styles.driverPhone} numberOfLines={1}>
                          📱 {item.phone || item.mobile || item.phone_number}
                        </Text>
                      )}
                      {(item.address || item.location) && (
                        <Text style={styles.driverPhone} numberOfLines={1}>
                          📍 {item.address || item.location}
                        </Text>
                      )}
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

  const renderEmptyState = () => {
    const isDriver = user?.role === 'driver';
    return (
      <View style={styles.emptyState}>
        <Ionicons name="car-outline" size={48} color="#ccc" />
        <Text style={styles.emptyStateText}>
          {isDriver ? 'No tartanilla assigned' : 'No carriages found'}
        </Text>
        <Text style={styles.emptyStateSubtext}>
          {isDriver 
            ? 'Contact your owner to get a tartanilla assigned to you'
            : 'Add your first carriage to get started'
          }
        </Text>
      </View>
    );
  };

  const renderEditModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showEditModal}
      onRequestClose={() => !savingEdit && setShowEditModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Carriage</Text>
            <TouchableOpacity onPress={() => !savingEdit && setShowEditModal(false)} disabled={savingEdit}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Plate Number</Text>
              <TextInput style={[styles.input, { backgroundColor: '#f5f5f5' }]} value={editingCarriage?.plate_number || ''} editable={false} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Capacity *</Text>
              <View style={styles.capacityContainer}>
                <TouchableOpacity 
                  style={styles.capacityButton}
                  onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.max(1, (parseInt(prev.capacity) || 4) - 1)) }))}
                  disabled={savingEdit}
                >
                  <Ionicons name="remove" size={20} color="#666" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.capacityInput, formErrors.capacity && styles.inputError]}
                  value={editForm.capacity}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, capacity: text }))}
                  keyboardType="numeric"
                  editable={!savingEdit}
                />
                <TouchableOpacity 
                  style={styles.capacityButton}
                  onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.min(10, (parseInt(prev.capacity) || 4) + 1)) }))}
                  disabled={savingEdit}
                >
                  <Ionicons name="add" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              {formErrors.capacity && <Text style={styles.errorText}>{formErrors.capacity}</Text>}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Status *</Text>
              <View style={styles.statusOptions}>
                {['available', 'in_use', 'maintenance', 'out_of_service'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      editForm.status === status && styles.statusOptionSelected,
                      { backgroundColor: (statusConfig[status]?.bgColor || '#f5f5f5') }
                    ]}
                    onPress={() => setEditForm(prev => ({ ...prev, status }))}
                    disabled={savingEdit}
                  >
                    <Ionicons name={(statusConfig[status]?.icon || 'help-circle')} size={16} color={(statusConfig[status]?.color || '#666')} style={styles.statusIcon} />
                    <Text style={[styles.statusOptionText, { color: (statusConfig[status]?.color || '#666') }, editForm.status === status && styles.statusOptionTextSelected]}>
                      {status === 'out_of_service' ? 'Out of Service' : (statusConfig[status]?.text || 'Unknown')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {formErrors.status && <Text style={styles.errorText}>{formErrors.status}</Text>}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any additional notes about this carriage"
                value={editForm.notes}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!savingEdit}
              />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, savingEdit && styles.buttonDisabled]} onPress={() => setShowEditModal(false)} disabled={savingEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton, savingEdit && styles.buttonDisabled]} onPress={handleUpdateCarriage} disabled={savingEdit}>
              {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>
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
        <Text style={styles.subheading}>
          {user?.role === 'driver' ? 'View your assigned carriages' : 'Manage your tartanilla carriages and drivers'}
        </Text>
      </View>
      
      {/* Driver Assignment Modal */}
      {renderDriverModal()}
      
      {(user?.role === 'owner' || user?.role === 'driver-owner') && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
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
      
      {/* Edit Carriage Modal */}
      {renderEditModal()}
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
    text: 'Awaiting Driver',
  },
  driver_assigned: {
    icon: 'person-circle',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    text: 'Driver Assigned',
  },
  out_of_service: {
    icon: 'close-circle',
    color: '#dc3545',
    bgColor: '#F5C6CB',
    text: 'Out of Service',
  },
  not_usable: {
    icon: 'close-circle',
    color: '#dc3545',
    bgColor: '#F5C6CB',
    text: 'Not Usable',
  },
  suspended: {
    icon: 'pause-circle',
    color: '#ff8f00',
    bgColor: '#FFF3E0',
    text: 'Suspended',
  },
  eligible: {
    icon: 'checkmark-circle',
    color: '#28a745',
    bgColor: '#E8F5E9',
    text: 'Eligible',
  },
  default: {
    icon: 'help-circle',
    color: '#6c757d',
    bgColor: '#f5f5f5',
    text: 'Unknown',
  }
};

const styles = StyleSheet.create({
  // Modern Card Styles
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  modernCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  plateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  plateInfo: {
    flex: 1,
  },
  modernPlateNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  modernStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  modernStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modernEditButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernCardContent: {
    gap: 16,
  },
  modernInfoGrid: {
    gap: 16,
  },
  modernInfoItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  modernInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  modernInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  modernInfoSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  modernActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modernAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modernChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modernReassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modernButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modernAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 12,
  },
  modernAlertText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    fontWeight: '500',
  },
  modernNotesSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  modernNotesText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
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
  statusEditButton: {
    marginLeft: 8,
    backgroundColor: MAROON,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  statusEditButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c757d',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  reassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 8,
  },
  reassignButtonText: {
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
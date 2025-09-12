import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { apiBaseUrl } from '../../services/networkConfig';
import { supabase } from '../../services/supabase';
import carriageService, { testCarriageConnection, setApiBaseUrl } from '../../services/tourpackage/fetchCarriage';
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
    eligibility: 'eligible',
    notes: ''
  });
  const [addingCarriage, setAddingCarriage] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [currentApiUrl, setCurrentApiUrl] = useState('');
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedCarriage, setSelectedCarriage] = useState(null);
  const [assigningDriver, setAssigningDriver] = useState(false);

  // All callback functions need to be defined before the conditional return
  const fetchAvailableDrivers = async () => {
    try {
      const drivers = await carriageService.getAvailableDrivers();
      setAvailableDrivers(Array.isArray(drivers) ? drivers : []);
    } catch (error) {
      console.error('Error fetching available drivers:', error);
      Alert.alert('Error', 'Failed to load available drivers');
    }
  };

  const handleAssignDriver = async (driverId) => {
    if (!selectedCarriage) return;
    
    setAssigningDriver(true);
    try {
      const updatedCarriage = await carriageService.updateCarriage(selectedCarriage.id, {
        driver: driverId
      });
      
      // Update the carriages list with the updated carriage
      setCarriages(carriages.map(carriage => 
        carriage.id === selectedCarriage.id ? { ...carriage, driver: updatedCarriage.driver } : carriage
      ));
      
      setShowDriverModal(false);
      Alert.alert('Success', 'Driver assigned successfully');
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
    await fetchAvailableDrivers();
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

      const data = await carriageService.getByOwner(currentUser.id);
      setCarriages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load carriages:', err);
      let errorMessage = 'Failed to load carriages';
      
      if (err.message.includes('Network request failed')) {
        errorMessage = 'Network error: Please check your internet connection and ensure the server is running at http://192.168.101.76:8000';
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
        const data = await carriageService.getByOwner(auth.user.id);
        setCarriages(Array.isArray(data) ? data : []);
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

      // Set the API endpoint
      const API_BASE_URL = `${apiBaseUrl()}/tartanilla-carriages/`;
      console.log('API Base URL:', API_BASE_URL);
      console.log('Current user object:', JSON.stringify(auth.user, null, 2));
      console.log('User ID being used:', auth.user?.id);
      
      if (!auth.user?.id) {
        console.error('No user ID found in auth.user:', auth);
        throw new Error('User not properly authenticated - missing ID');
      }
      
      // Prepare the payload with all required fields
      const payload = {
        plate_number: carriageData.plate_number,
        capacity: parseInt(carriageData.capacity) || 4,
        status: carriageData.status,
        eligibility: carriageData.eligibility,
        notes: carriageData.notes,
        assigned_owner_id: auth.user.id  // Remove toString() to send as raw UUID
      };
      
      console.log('Final payload being sent:', JSON.stringify(payload, null, 2));
      
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      
      if (!payload.plate_number || !payload.assigned_owner_id) {
        throw new Error('Missing required fields');
      }
      
      // First, check if a carriage with this plate number already exists
      const existingCarriages = await carriageService.getAllCarriages();
      const duplicate = Array.isArray(existingCarriages) && 
        existingCarriages.some(carriage => 
          carriage.plate_number?.toLowerCase() === carriageData.plate_number?.toLowerCase()
        );
      
      if (duplicate) {
        Alert.alert('Error', 'A carriage with this plate number already exists');
        setAddingCarriage(false);
        return;
      }

      // Make the API call
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error details:', errorData);
          
          // Handle field-specific errors
          if (errorData.plate_number) {
            errorMessage = `Plate number: ${Array.isArray(errorData.plate_number) ? errorData.plate_number.join(' ') : errorData.plate_number}`;
          } else if (errorData.assigned_owner) {
            errorMessage = `Owner error: ${Array.isArray(errorData.assigned_owner) ? errorData.assigned_owner.join(' ') : errorData.assigned_owner}`;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData === 'object') {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = JSON.parse(responseText);
      
      if (!result) {
        throw new Error('Failed to add carriage: No response from server');
      }

      // Reset form and close modal on success
      setShowAddModal(false);
      setNewCarriage({
        plate_number: '',
        capacity: '4',
        status: 'available',
        eligibility: 'eligible',
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
      default: {
        icon: 'help-circle',
        color: '#6c757d',
        bgColor: '#f5f5f5',
        text: 'Unknown',
        iconColor: '#6c757d'
      }
    };

    const status = statusConfig[carriage.status?.toLowerCase()] || statusConfig.default;
    const driverName = carriage.driver 
      ? `${carriage.driver.first_name} ${carriage.driver.last_name}`
      : 'Not assigned';

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
            </View>
            <TouchableOpacity 
              style={[styles.assignButton, { opacity: assigningDriver ? 0.6 : 1 }]}
              onPress={() => openDriverModal(carriage)}
              disabled={assigningDriver}
            >
              <Ionicons 
                name={carriage.driver ? "sync-outline" : "person-add"} 
                size={14} 
                color="#fff"
              />
              <Text style={styles.assignButtonText}>
                {carriage.driver ? 'Change' : 'Assign'}
              </Text>
            </TouchableOpacity>
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
                <Text style={styles.emptyStateText}>No available drivers found</Text>
                <Text style={styles.emptyStateSubtext}>
                  All drivers are currently assigned to carriages.
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableDrivers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.driverItem}
                    onPress={() => handleAssignDriver(item.id)}
                    disabled={assigningDriver}
                  >
                    <View style={styles.driverAvatar}>
                      <Ionicons name="person-circle-outline" size={40} color="#666" />
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>
                        {item.first_name} {item.last_name}
                      </Text>
                      <Text style={styles.driverEmail} numberOfLines={1}>
                        {item.email}
                      </Text>
                      <Text style={styles.driverPhone}>
                        {item.phone_number || 'No phone number'}
                      </Text>
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
                <Text style={styles.label}>Eligibility</Text>
                <View style={styles.eligibilityContainer}>
                  {['eligible', 'not_eligible'].map((eligibility) => (
                    <TouchableOpacity
                      key={eligibility}
                      style={[
                        styles.eligibilityOption,
                        newCarriage.eligibility === eligibility && styles.eligibilityOptionSelected,
                      ]}
                      onPress={() => setNewCarriage({...newCarriage, eligibility})}
                      disabled={addingCarriage}
                    >
                      <Text style={[
                        styles.eligibilityOptionText,
                        newCarriage.eligibility === eligibility && styles.eligibilityOptionTextSelected
                      ]}>
                        {eligibility === 'eligible' ? 'Eligible' : 'Not Eligible'}
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


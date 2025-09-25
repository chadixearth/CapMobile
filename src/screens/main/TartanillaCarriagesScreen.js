import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { apiBaseUrl } from '../../services/networkConfig';
import { supabase } from '../../services/supabase';
import { getMyCarriages, getAvailableDrivers, getAllDrivers, assignDriverToCarriage, cancelDriverAssignment, reassignDriver, createCarriage, createTestDrivers } from '../../services/tartanillaService';
import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');
const MAROON = '#6B2E2B';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333';

export default function TartanillaCarriagesScreen({ navigation, hideHeader = false }) {
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
  const [modalAction, setModalAction] = useState('assign'); // 'assign', 'reassign', 'cancel'

  const fetchDrivers = async (action = 'assign') => {
    try {
      let result;
      if (action === 'reassign') {
        result = await getAllDrivers();
      } else {
        result = await getAvailableDrivers();
      }
      
      if (result.success) {
        setAvailableDrivers(result.data || []);
        
        if (result.data.length === 0 && result.debug) {
          console.log('No drivers found. Debug info:', result.debug);
          const debugMsg = `Debug Info:\n` +
            `Total users: ${result.debug.total_users}\n` +
            `Total drivers: ${result.debug.total_drivers}\n` +
            `Available drivers: ${result.debug.available_drivers}`;
          
          Alert.alert(
            'No Drivers Found', 
            `${debugMsg}\n\nWould you like to create test drivers for development?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Create Test Drivers', 
                onPress: async () => {
                  const createResult = await createTestDrivers();
                  if (createResult.success) {
                    Alert.alert('Success', 'Test drivers created! Refreshing list...');
                    await fetchDrivers(action);
                  } else {
                    Alert.alert('Error', createResult.error || 'Failed to create test drivers');
                  }
                }
              }
            ]
          );
        }
      } else {
        console.error('Error fetching drivers:', result.error);
        Alert.alert('Error', result.error || 'Failed to load drivers');
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      Alert.alert('Error', 'Failed to load drivers');
    }
  };

  const handleDriverAction = async (driverId) => {
    if (!selectedCarriage) return;
    
    setAssigningDriver(true);
    try {
      let result;
      let successMessage;
      
      if (modalAction === 'assign') {
        result = await assignDriverToCarriage(selectedCarriage.id, driverId);
        successMessage = 'Driver invitation sent! Waiting for driver acceptance.';
      } else if (modalAction === 'reassign') {
        result = await reassignDriver(selectedCarriage.id, driverId);
        successMessage = 'Driver reassignment request sent!';
      }
      
      if (result.success) {
        setShowDriverModal(false);
        Alert.alert('Success', successMessage, [
          {
            text: 'OK',
            onPress: async () => {
              await fetchUserAndCarriages();
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.error || `Failed to ${modalAction} driver`);
      }
    } catch (error) {
      console.error(`Error ${modalAction} driver:`, error);
      Alert.alert('Error', `Failed to ${modalAction} driver`);
    } finally {
      setAssigningDriver(false);
    }
  };
  
  const handleCancelAssignment = async () => {
    if (!selectedCarriage) return;
    
    Alert.alert(
      'Cancel Assignment',
      'Are you sure you want to cancel this driver assignment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setAssigningDriver(true);
            try {
              const result = await cancelDriverAssignment(selectedCarriage.id);
              
              if (result.success) {
                setShowDriverModal(false);
                Alert.alert('Success', 'Driver assignment cancelled.', [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await fetchUserAndCarriages();
                    }
                  }
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel assignment');
              }
            } catch (error) {
              console.error('Error cancelling assignment:', error);
              Alert.alert('Error', 'Failed to cancel assignment');
            } finally {
              setAssigningDriver(false);
            }
          }
        }
      ]
    );
  };

  const openDriverModal = async (carriage, action = 'assign') => {
    setSelectedCarriage(carriage);
    setModalAction(action);
    setShowDriverModal(true);
    await fetchDrivers(action);
  };

  const handleAddCarriage = async () => {
    if (!newCarriage.plate_number.trim()) {
      Alert.alert('Error', 'Please enter a plate number');
      return;
    }

    setAddingCarriage(true);
    try {
      const result = await createCarriage({
        plate_number: newCarriage.plate_number.trim(),
        capacity: parseInt(newCarriage.capacity) || 4,
        status: newCarriage.status || 'available',
        notes: newCarriage.notes || ''
      });
      
      if (result.success) {
        setShowAddModal(false);
        setNewCarriage({
          plate_number: '',
          capacity: '4', 
          status: 'available',
          notes: ''
        });
        Alert.alert('Success', 'Tartanilla added successfully!', [
          {
            text: 'OK',
            onPress: () => fetchUserAndCarriages()
          }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to add tartanilla');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add tartanilla');
    } finally {
      setAddingCarriage(false);
    }
  };

  const fetchUserAndCarriages = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = auth.user;
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view your carriages');
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const role = currentUser.role;
      if (role !== 'owner' && role !== 'driver-owner') {
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
      if (auth.user?.role === 'owner' || auth.user?.role === 'driver-owner') {
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
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
      return;
    }
    
    if (auth.isAuthenticated) {
      fetchUserAndCarriages();
    }
  }, [auth.loading, auth.isAuthenticated, fetchUserAndCarriages, navigation]);

  if (auth.loading) {
    return (
      <View style={styles.container}>
        {!hideHeader && (
          <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} />
        )}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!auth.isAuthenticated) {
    return null;
  }

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
    
    const driverName = carriage.assigned_driver?.name || (carriage.assigned_driver_id ? `Driver ID: ${carriage.assigned_driver_id}` : 'Not assigned');
    const driverEmail = carriage.assigned_driver?.email || (carriage.assigned_driver_id ? `ID: ${carriage.assigned_driver_id}` : '');
    
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
          {/* Status Indicator */}
          {(carriage.status === 'waiting_driver_acceptance' || carriage.status === 'driver_assigned') && (
            <View style={[styles.statusIndicatorBar, 
              carriage.status === 'waiting_driver_acceptance' ? styles.pendingBar : styles.assignedBar
            ]}>
              <Ionicons 
                name={carriage.status === 'waiting_driver_acceptance' ? 'hourglass-outline' : 'checkmark-circle'} 
                size={16} 
                color={carriage.status === 'waiting_driver_acceptance' ? '#ff8f00' : '#28a745'} 
              />
              <Text style={[styles.statusIndicatorText,
                carriage.status === 'waiting_driver_acceptance' ? styles.pendingText : styles.assignedStatusText
              ]}>
                {carriage.status === 'waiting_driver_acceptance' 
                  ? 'Pending Driver Confirmation' 
                  : 'Driver Confirmed & Active'
                }
              </Text>
            </View>
          )}
          
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color="#555" style={styles.infoIcon} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Driver</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{driverName}</Text>
              {driverEmail && (
                <Text style={[styles.infoLabel, { marginTop: 2, fontSize: 11, color: '#888' }]} numberOfLines={1}>{driverEmail}</Text>
              )}
            </View>
            <View style={styles.actionButtons}>
              {carriage.status === 'driver_assigned' ? (
                <View style={styles.assignedIndicator}>
                  <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                  <Text style={styles.assignedText}>Driver Confirmed</Text>
                </View>
              ) : carriage.status === 'waiting_driver_acceptance' ? (
                <TouchableOpacity 
                  style={[styles.cancelButton, { opacity: assigningDriver ? 0.6 : 1 }]}
                  onPress={() => {
                    setSelectedCarriage(carriage);
                    handleCancelAssignment();
                  }}
                  disabled={assigningDriver}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                  <Text style={styles.cancelButtonText}>Cancel Assignment</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.assignButton, { opacity: assigningDriver ? 0.6 : 1 }]}
                  onPress={() => openDriverModal(carriage, carriage.assigned_driver ? 'reassign' : 'assign')}
                  disabled={assigningDriver}
                >
                  <Ionicons 
                    name={carriage.assigned_driver ? "sync-outline" : "person-add"} 
                    size={14} 
                    color="#fff"
                  />
                  <Text style={styles.assignButtonText}>
                    {carriage.assigned_driver ? 'Reassign' : 'Assign'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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

  const renderDriverModal = () => {
    const getModalTitle = () => {
      switch (modalAction) {
        case 'reassign': return 'Reassign Driver';
        case 'assign': return 'Assign Driver';
        default: return 'Select Driver';
      }
    };
    
    const getEmptyMessage = () => {
      switch (modalAction) {
        case 'reassign': return 'No drivers found';
        case 'assign': return 'No available drivers found';
        default: return 'No drivers found';
      }
    };
    
    const getEmptySubtext = () => {
      switch (modalAction) {
        case 'reassign': return 'Unable to load driver list.';
        case 'assign': return 'All drivers are currently assigned to carriages.';
        default: return 'Unable to load drivers.';
      }
    };
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDriverModal}
        onRequestClose={() => !assigningDriver && setShowDriverModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.driverModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getModalTitle()}</Text>
              <TouchableOpacity 
                onPress={() => !assigningDriver && setShowDriverModal(false)}
                disabled={assigningDriver}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.scrollableModalBody}>
              {availableDrivers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyStateText}>{getEmptyMessage()}</Text>
                  <Text style={styles.emptyStateSubtext}>
                    {getEmptySubtext()}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={availableDrivers}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.driverItem, assigningDriver && styles.driverItemDisabled]}
                      onPress={() => handleDriverAction(item.id)}
                      disabled={assigningDriver}
                      activeOpacity={0.7}
                    >
                      <View style={styles.driverAvatar}>
                        <View style={styles.defaultAvatar}>
                          <Ionicons name="person" size={24} color={MAROON} />
                        </View>
                      </View>
                      <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>
                          {item.name || 'Unknown Driver'}
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
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  contentContainerStyle={{ flexGrow: 1 }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {!hideHeader && (
        <TARTRACKHeader 
          title="My Tartanilla Carriages"
          onNotificationPress={() => navigation.navigate('NotificationScreen')} 
        />
      )}
      
      {!hideHeader && (
        <View style={styles.headerContainer}>
          <Text style={styles.heading}>Carriage Management</Text>
          <Text style={styles.subheading}>Manage your tartanilla carriages and drivers</Text>
        </View>
      )}
      
      {renderDriverModal()}
      
      {(user?.role === 'owner' || user?.role === 'driver-owner') && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
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
              <Text style={styles.modalTitle}>Add New Tartanilla</Text>
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
                  style={styles.input}
                  placeholder="e.g., ABC 123"
                  value={newCarriage.plate_number}
                  onChangeText={(text) => setNewCarriage({...newCarriage, plate_number: text})}
                  editable={!addingCarriage}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Capacity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4"
                  value={newCarriage.capacity}
                  onChangeText={(text) => setNewCarriage({...newCarriage, capacity: text})}
                  keyboardType="numeric"
                  editable={!addingCarriage}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any additional notes"
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
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
                disabled={addingCarriage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleAddCarriage}
                disabled={addingCarriage}
              >
                {addingCarriage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Tartanilla</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
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
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No Carriages Found</Text>
              <Text style={styles.emptyStateSubtitle}>
                {auth.user?.role === 'owner'
                  ? 'You have not registered any tartanilla carriages yet.'
                  : 'Only owners can view their tartanilla carriages.'}
              </Text>
            </View>
          ) : (
            carriages.map((carriage) => renderCarriageCard(carriage))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  assignedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  assignedText: {
    color: '#28a745',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  statusIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  pendingBar: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff8f00',
  },
  assignedBar: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  statusIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingText: {
    color: '#ff8f00',
  },
  assignedStatusText: {
    color: '#28a745',
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  driverModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '85%',
    elevation: 5,
    flex: 1,
    marginVertical: 50,
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
  scrollableModalBody: {
    flex: 1,
    maxHeight: '100%',
  },
  driverItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
  },
  driverAvatar: {
    marginRight: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  driverProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
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
    marginTop: 2,
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
    marginLeft: 78,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
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
  // Add Modal Styles
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
    elevation: 5,
  },
  modalBody: {
    padding: 16,
    maxHeight: '70%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
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
  saveButton: {
    backgroundColor: MAROON,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
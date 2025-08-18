import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  TextInput,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
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
  const [currentApiUrl, setCurrentApiUrl] = useState('http://192.168.1.8:8000/api/tartanilla-carriages/');

  // All callback functions need to be defined before the conditional return
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
        errorMessage = 'Network error: Please check your internet connection and ensure the server is running at http://192.168.1.8:8000';
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
      const carriageData = {
        ...newCarriage,
        assigned_owner_id: auth.user.id,
        capacity: parseInt(newCarriage.capacity) || 4
      };

      console.log('Sending carriage data:', carriageData);
      const result = await carriageService.createCarriage(carriageData);
      
      if (result) {
        Alert.alert('Success', 'Carriage added successfully!');
        setShowAddModal(false);
        setNewCarriage({
          plate_number: '',
          capacity: '4',
          status: 'available',
          eligibility: 'eligible',
          notes: ''
        });
        // Refresh the list
        fetchUserAndCarriages();
      } else {
        Alert.alert('Error', 'Failed to add carriage');
      }
    } catch (error) {
      console.error('Error adding carriage:', error);
      let errorMessage = error.message || 'Failed to add carriage';
      
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error: Please check your internet connection and ensure the server is running at http://192.168.1.8:8000';
      } else if (error.message.includes('HTTP error')) {
        errorMessage = `Server error: ${error.message}`;
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
        icon: 'checkmark-circle-outline', 
        color: '#28a745',
        bgColor: '#E7F6EC',
        text: 'Available'
      },
      in_use: { 
        icon: 'time-outline', 
        color: '#dc3545',
        bgColor: '#FDECEC',
        text: 'In Use'
      },
      maintenance: { 
        icon: 'build-outline', 
        color: '#ffc107',
        bgColor: '#FFF4E5',
        text: 'Maintenance'
      },
      default: {
        icon: 'help-circle-outline',
        color: '#6c757d',
        bgColor: '#f8f9fa',
        text: 'Unknown'
      }
    };

    const status = carriage.status?.toLowerCase() || 'default';
    const { icon, color, bgColor, text } = statusConfig[status] || statusConfig.default;

    return (
      <View key={carriage.id || carriage.plate_number} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Ionicons name="car-sport" size={24} color={MAROON} style={styles.cardIcon} />
            <Text style={styles.cardTitle}>{carriage.plate_number}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: bgColor }]}>
            <Ionicons name={icon} size={14} color={color} />
            <Text style={[styles.statusText, { color }]}>{text.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Ionicons name="people-outline" size={18} color="#666" />
          <Text style={styles.rowText}>Capacity: {carriage.capacity ?? 'N/A'} persons</Text>
        </View>

        {carriage.eligibility && (
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#666" />
            <Text style={styles.rowText}>Eligibility: {carriage.eligibility}</Text>
          </View>
        )}

        <View style={styles.row}>
          <Ionicons name="person-outline" size={18} color="#666" />
          <Text style={styles.rowText}>
            {carriage.assigned_driver 
              ? `Driver: ${carriage.assigned_driver.name || carriage.assigned_driver.email}`
              : 'No driver assigned'}
          </Text>
        </View>

        {carriage.notes && (
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Ionicons name="document-text-outline" size={18} color="#666" style={{ marginTop: 2 }} />
            <Text style={[styles.rowText, { flex: 1 }]} numberOfLines={3}>{carriage.notes}</Text>
          </View>
        )}
      </View>
    );
  };


  return (
    <View style={styles.container}>
      <TARTRACKHeader 
        title="My Carriages"
        navigation={navigation}
        rightComponent={
          auth.user?.role === 'owner' && (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )
        }
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>My Tartanilla Carriages</Text>
            <Text style={styles.subtitle}>
              {auth.user?.name || auth.user?.email || 'Owner'}
            </Text>
            <Text style={styles.apiUrl}>API: {currentApiUrl}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={carriages.length === 0 && styles.emptyScrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[MAROON]}
              tintColor={MAROON}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {carriages.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.carriagesList}>
              {carriages.map(renderCarriageCard)}
              
              {auth.user?.role === 'owner' && (
                <TouchableOpacity 
                  style={[styles.card, styles.addCard]}
                  onPress={() => setShowAddModal(true)}
                >
                  <Ionicons name="add-circle" size={40} color={MAROON} />
                  <Text style={styles.addCardText}>Add New Carriage</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        {/* Add Carriage Modal */}
        <Modal
          visible={showAddModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Carriage</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Plate Number *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newCarriage.plate_number}
                    onChangeText={(text) => setNewCarriage({...newCarriage, plate_number: text})}
                    placeholder="Enter plate number"
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Capacity</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newCarriage.capacity}
                    onChangeText={(text) => setNewCarriage({...newCarriage, capacity: text})}
                    placeholder="4"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <View style={styles.statusOptions}>
                    {['available', 'unavailable', 'maintenance'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusOption,
                          newCarriage.status === status && styles.statusOptionSelected
                        ]}
                        onPress={() => setNewCarriage({...newCarriage, status})}
                      >
                        <Text style={[
                          styles.statusOptionText,
                          newCarriage.status === status && styles.statusOptionTextSelected
                        ]}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Eligibility</Text>
                  <View style={styles.statusOptions}>
                    {['eligible', 'ineligible'].map((eligibility) => (
                      <TouchableOpacity
                        key={eligibility}
                        style={[
                          styles.statusOption,
                          newCarriage.eligibility === eligibility && styles.statusOptionSelected
                        ]}
                        onPress={() => setNewCarriage({...newCarriage, eligibility})}
                      >
                        <Text style={[
                          styles.statusOptionText,
                          newCarriage.eligibility === eligibility && styles.statusOptionTextSelected
                        ]}>
                          {eligibility.charAt(0).toUpperCase() + eligibility.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={newCarriage.notes}
                    onChangeText={(text) => setNewCarriage({...newCarriage, notes: text})}
                    placeholder="Optional notes about the carriage"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, addingCarriage && styles.saveButtonDisabled]} 
                  onPress={handleAddCarriage}
                  disabled={addingCarriage}
                >
                  <Text style={styles.saveButtonText}>
                    {addingCarriage ? 'Adding...' : 'Add Carriage'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

function getStatusStyle(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'available') return { backgroundColor: '#E7F6EC' };
  if (normalized === 'unavailable') return { backgroundColor: '#FDECEC' };
  if (normalized === 'maintenance') return { backgroundColor: '#FFF4E5' };
  return { backgroundColor: '#EEE' };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingRight: 15,
  },
  headerButtons: {
    marginTop: 25,
  },
  headerInfo: {
    flex: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MAROON,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  apiUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: MAROON,
    marginBottom: 2,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  apiUrl: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
    fontFamily: 'monospace',
  },
  addButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MAROON,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#666',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  emptyScrollView: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  carriagesList: {
    padding: 16,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderStyle: 'dashed',
    borderColor: MAROON,
    backgroundColor: '#fafafa',
  },
  addCardText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: MAROON,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardIcon: {
    marginRight: 8,
  },
  cardDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  rowText: {
    marginLeft: 10,
    color: DARK_GRAY,
    flex: 1,
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  emptyStateSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  testConnectionButton: {
    backgroundColor: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  testConnectionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: MAROON,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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




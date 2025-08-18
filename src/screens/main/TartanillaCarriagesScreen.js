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

const { width } = Dimensions.get('window');
const MAROON = '#6B2E2B';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333';

export default function TartanillaCarriagesScreen({ navigation }) {
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

  useEffect(() => {
    fetchUserAndCarriages();
  }, []);

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

  const fetchUserAndCarriages = async () => {
    try {
      setLoading(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'Please log in to view your carriages');
        setLoading(false);
        return;
      }

      setUser(user);

      // Only owners should see their carriages
      const role = user.user_metadata?.role;
      if (role !== 'owner') {
        setCarriages([]);
        setLoading(false);
        return;
      }

      const data = await carriageService.getByOwner(user.id);
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
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.user_metadata?.role === 'owner') {
        const data = await carriageService.getByOwner(user.id);
        setCarriages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

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
        assigned_owner_id: user.id,
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
      <Ionicons name="car-outline" size={80} color="#ddd" />
      <Text style={styles.emptyStateTitle}>
        {loading ? 'Loading...' : 'No Carriages Found'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {loading 
          ? 'Fetching your carriages...'
          : user?.user_metadata?.role === 'owner'
            ? 'You have not registered any tartanilla carriages yet.'
            : 'Only owners can view their tartanilla carriages.'}
      </Text>
      
      {user?.user_metadata?.role === 'owner' && !loading && (
        <View style={styles.emptyStateActions}>
          <TouchableOpacity 
            style={[styles.button, {backgroundColor: MAROON, marginBottom: 10}]} 
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Add New Carriage</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, {backgroundColor: '#555'}]} 
            onPress={testConnection}
          >
            <Ionicons name="wifi" size={18} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Test API Connection</Text>
          </TouchableOpacity>
        </View>
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

  const renderCarriageCard = (carriage) => (
    <View key={carriage.id || carriage.plate_number} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Ionicons name="car-sport" size={24} color={MAROON} style={styles.cardIcon} />
          <Text style={styles.cardTitle}>{carriage.plate_number}</Text>
        </View>
        <View style={[styles.statusPill, getStatusStyle(carriage.status)]}>
          <Text style={styles.statusText}>{(carriage.status || 'unknown').replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Capacity:</Text>
          <Text style={styles.detailValue}>{carriage.capacity} persons</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={[styles.detailValue, getStatusTextStyle(carriage.status)]}>
            {carriage.status ? carriage.status.replace('_', ' ') : 'N/A'}
          </Text>
        </View>
        {carriage.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Notes:</Text>
            <Text style={[styles.detailValue, {flex: 1}]} numberOfLines={2}>
              {carriage.notes}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <Ionicons name="people-outline" size={18} color="#666" />
        <Text style={styles.rowText}>Capacity: {carriage.capacity ?? 'N/A'}</Text>
      </View>

      {carriage.eligibility && (
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#666" />
          <Text style={styles.rowText}>Eligibility: {carriage.eligibility}</Text>
        </View>
      )}

      {carriage.assigned_driver && (
        <View style={styles.row}>
          <Ionicons name="person-outline" size={18} color="#666" />
          <Text style={styles.rowText}>Driver: {carriage.assigned_driver.name || carriage.assigned_driver.email}</Text>
        </View>
      )}

      {carriage.notes && (
        <View style={[styles.row, { alignItems: 'flex-start' }] }>
          <Ionicons name="document-text-outline" size={18} color="#666" style={{ marginTop: 2 }} />
          <Text style={[styles.rowText, { flex: 1 }]} numberOfLines={3}>{carriage.notes}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <TARTRACKHeader 
        title="My Carriages"
        navigation={navigation}
        rightComponent={
          user?.user_metadata?.role === 'owner' && (
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
          <View style={styles.headerInfo}>
            <Text style={styles.title}>My Tartanilla Carriages</Text>
            <Text style={styles.subtitle}>
              {user?.user_metadata?.name || user?.email || 'Owner'}
            </Text>
            {__DEV__ && (
              <TouchableOpacity 
                onPress={testConnection}
                style={styles.apiUrlContainer}
              >
                <Ionicons name="wifi" size={14} color="#666" />
                <Text style={styles.apiUrl}>
                  {currentApiUrl.replace('http://', '').replace('/api/tartanilla-carriages/', '')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={fetchUserAndCarriages}
            disabled={loading}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#fff" 
              style={refreshing ? { transform: [{ rotate: '360deg' }] } : null}
            />
          </TouchableOpacity>
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
              
              {user?.user_metadata?.role === 'owner' && (
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerInfo: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MAROON,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  apiUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: MAROON,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MAROON,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
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




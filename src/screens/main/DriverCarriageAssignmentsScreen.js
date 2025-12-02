import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Animated,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import LoadingScreen from '../../components/LoadingScreen';
import { getCurrentUser } from '../../services/authService';
import { getCarriagesByDriver, acceptCarriageAssignment, declineCarriageAssignment, updateCarriageStatus } from '../../services/api';
import { CustomAlert } from '../../utils/customAlert';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';
const CARD_BG = '#FFFFFF';
const SUCCESS = '#2E7D32';
const WARNING = '#F57C00';

export default function DriverCarriageAssignmentsScreen({ navigation, hideHeader = false }) {
  useLayoutEffect(() => {
    if (!hideHeader) {
      navigation.setOptions?.({ headerShown: false });
    }
  }, [navigation, hideHeader]);

  const [user, setUser] = useState(null);
  const [carriages, setCarriages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedCarriage, setSelectedCarriage] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectingCarriage, setSelectingCarriage] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  const getOwnerName = (carriage) => {
    const ownerName = carriage.assigned_owner?.name || 
                     carriage.owner?.name || 
                     carriage.owner_name || 
                     carriage.assigned_owner?.email || 
                     carriage.owner?.email || 
                     carriage.owner_email;
    console.log('Owner lookup for', carriage.plate_number, ':', { ownerName, assigned_owner: carriage.assigned_owner });
    return ownerName || 'Unknown';
  };

  const getAvailableStatuses = (carriage) => {
    // If carriage is in maintenance, driver can't change to available or in_use
    if (carriage?.status === 'maintenance') {
      return [
        { value: 'maintenance', label: 'Maintenance', icon: 'build', color: '#FF9800' },
      ];
    }
    
    // Normal statuses for drivers
    return [
      { value: 'available', label: 'Available', icon: 'checkmark-circle', color: SUCCESS },
      { value: 'in_use', label: 'In Use', icon: 'time', color: WARNING },
      { value: 'maintenance', label: 'Maintenance', icon: 'build', color: '#FF9800' },
    ];
  };

  useEffect(() => {
    fetchUserAndCarriages();
  }, []);

  useEffect(() => {
    if (loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      
      const createDotAnimation = (animValue, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.delay(600 - delay),
          ])
        );
      };
      
      pulse.start();
      createDotAnimation(dot1Anim, 0).start();
      createDotAnimation(dot2Anim, 200).start();
      createDotAnimation(dot3Anim, 400).start();
      
      return () => {
        pulse.stop();
        dot1Anim.stopAnimation();
        dot2Anim.stopAnimation();
        dot3Anim.stopAnimation();
      };
    }
  }, [loading, pulseAnim, dot1Anim, dot2Anim, dot3Anim]);

  const fetchUserAndCarriages = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        CustomAlert.error('Error', 'Please log in to view assignments');
        return;
      }
      setUser(currentUser);
      console.log('Fetching carriages for driver:', currentUser.id);

      // Try both API methods to ensure we get carriage data
      const [apiResponse, serviceResponse] = await Promise.allSettled([
        getCarriagesByDriver(currentUser.id),
        import('../../services/tartanillaService').then(service => service.getMyCarriages())
      ]);
      
      console.log('API Response:', apiResponse);
      console.log('Service Response:', serviceResponse);
      
      let carriageData = [];
      
      // Try API response first
      if (apiResponse.status === 'fulfilled' && apiResponse.value?.success) {
        carriageData = apiResponse.value.data || [];
        console.log('Using API response data:', carriageData);
      }
      // Fallback to service response
      else if (serviceResponse.status === 'fulfilled' && serviceResponse.value?.success) {
        carriageData = serviceResponse.value.data || [];
        console.log('Using service response data:', carriageData);
      }
      
      console.log('Final carriage data:', carriageData);
      // Debug owner data structure
      if (carriageData.length > 0) {
        console.log('First carriage owner data:', {
          assigned_owner: carriageData[0].assigned_owner,
          owner: carriageData[0].owner,
          assigned_owner_id: carriageData[0].assigned_owner_id,
          owner_name: carriageData[0].owner_name,
          owner_email: carriageData[0].owner_email
        });
      }
      setCarriages(carriageData);
      
    } catch (error) {
      console.error('Error fetching carriages:', error);
      setCarriages([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndCarriages();
    setRefreshing(false);
  };

  const handleAcceptAssignment = async (carriageId) => {
    if (!user) return;
    
    setProcessingId(carriageId);
    try {
      const response = await acceptCarriageAssignment(carriageId, user.id);
      if (response.success) {
        CustomAlert.success('Assignment Accepted!', 'You have successfully accepted this carriage assignment.');
        await fetchUserAndCarriages();
      } else {
        CustomAlert.error('Failed to Accept', response.error || 'Failed to accept assignment');
      }
    } catch (error) {
      console.error('Error accepting assignment:', error);
      CustomAlert.error('Error', 'Failed to accept assignment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineAssignment = (carriageId) => {
    CustomAlert.confirm(
      'Decline Assignment',
      'Are you sure you want to decline this carriage assignment?',
      () => confirmDecline(carriageId)
    );
  };

  const confirmDecline = async (carriageId) => {
    if (!user) return;
    
    setProcessingId(carriageId);
    try {
      const response = await declineCarriageAssignment(carriageId, user.id);
      if (response.success) {
        CustomAlert.success('Assignment Declined', 'You have declined this carriage assignment.');
        await fetchUserAndCarriages();
      } else {
        CustomAlert.error('Failed to Decline', response.error || 'Failed to decline assignment');
      }
    } catch (error) {
      console.error('Error declining assignment:', error);
      CustomAlert.error('Error', 'Failed to decline assignment');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting_driver_acceptance':
        return WARNING;
      case 'driver_assigned':
        return SUCCESS;
      default:
        return MUTED;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'waiting_driver_acceptance':
        return 'Pending Acceptance';
      case 'driver_assigned':
        return 'Assigned';
      case 'available':
        return 'Available';
      default:
        return status;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting_driver_acceptance':
        return 'hourglass-outline';
      case 'driver_assigned':
        return 'person-circle';
      case 'available':
        return 'checkmark-circle';
      case 'in_use':
        return 'time';
      case 'maintenance':
        return 'build';
      default:
        return 'help-circle';
    }
  };

  const openStatusModal = (carriage) => {
    setSelectedCarriage(carriage);
    setStatusModalVisible(true);
  };

  const handleUpdateCarriageStatus = async (carriageId, newStatus) => {
    // Prevent drivers from changing status if carriage is in maintenance
    const carriage = carriages.find(c => c.id === carriageId);
    if (carriage?.status === 'maintenance' && newStatus !== 'maintenance') {
      CustomAlert.error('Cannot Change Status', 'This carriage is in maintenance mode. Only the owner can change it back to service.');
      return;
    }
    
    // Prevent having two carriages in use at the same time
    if (newStatus === 'in_use') {
      const inUseCount = assignedCarriages.filter(c => c.status === 'in_use' && c.id !== carriageId).length;
      if (inUseCount >= 1) {
        CustomAlert.error('Cannot Set In Use', 'You can only have one carriage in use at a time.');
        return;
      }
    }
    
    setUpdatingStatus(true);
    try {
      const response = await updateCarriageStatus(carriageId, newStatus);
      if (response.success) {
        CustomAlert.success('Status Updated!', 'Carriage status has been updated successfully.');
        setStatusModalVisible(false);
        await fetchUserAndCarriages();
      } else {
        CustomAlert.error('Update Failed', response.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      CustomAlert.error('Error', 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSelectCarriage = async (carriageId) => {
    const carriage = carriages.find(c => c.id === carriageId);
    
    // Prevent selecting carriage if it's in maintenance
    if (carriage?.status === 'maintenance') {
      CustomAlert.error('Cannot Select', 'This carriage is in maintenance mode and cannot be used.');
      return;
    }
    
    const inUseCount = assignedCarriages.filter(c => c.status === 'in_use').length;
    if (inUseCount >= 1) {
      CustomAlert.error('Limit Reached', 'You can only have 1 carriage in use at a time.');
      return;
    }

    setSelectingCarriage(carriageId);
    try {
      const { apiClient } = await import('../../services/improvedApiClient');
      const response = await apiClient.post(`/tartanilla-carriages/${carriageId}/select-for-use/`, {
        driver_id: user.id
      });
      if (response.success) {
        CustomAlert.success('Carriage Selected!', 'This carriage is now in use.');
        await fetchUserAndCarriages();
      } else {
        CustomAlert.error('Selection Failed', response.error || 'Failed to select carriage');
      }
    } catch (error) {
      console.error('Error selecting carriage:', error);
      CustomAlert.error('Error', 'Failed to select carriage');
    } finally {
      setSelectingCarriage(null);
    }
  };

  const pendingCarriages = carriages.filter(c => c.status === 'waiting_driver_acceptance');
  const assignedCarriages = carriages.filter(c => 
    c.status === 'driver_assigned' || 
    c.status === 'available' || 
    c.status === 'in_use' || 
    c.status === 'maintenance'
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {!hideHeader && (
          <TARTRACKHeader
            onMessagePress={() => navigation.navigate('Chat')}
            onNotificationPress={() => navigation.navigate('Notification')}
          />
        )}
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
            <Image 
              source={require('../../../assets/TarTrack Logo_sakto.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
          <View style={styles.loadingTextContainer}>
            <Text style={styles.loadingTextBase}>Loading carriage assignments</Text>
            <Animated.Text style={[styles.dot, { opacity: dot1Anim }]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, { opacity: dot2Anim }]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, { opacity: dot3Anim }]}>.</Animated.Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {!hideHeader && (
        <TARTRACKHeader
          onMessagePress={() => navigation.navigate('Chat')}
          onNotificationPress={() => navigation.navigate('Notification')}
        />
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {!hideHeader && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={MAROON} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>My Carriages</Text>
          <TouchableOpacity 
            style={styles.refreshHeaderButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons 
              name={refreshing ? "refresh" : "refresh-outline"} 
              size={20} 
              color={MAROON} 
            />
          </TouchableOpacity>
        </View>

        {/* Pending Assignments */}
        {pendingCarriages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Pending Assignments</Text>
            {pendingCarriages.map((carriage) => (
              <View key={carriage.id} style={styles.carriageCard}>
                <View style={styles.carriageHeader}>
                  <View style={styles.carriageInfo}>
                    <Text style={styles.plateNumber}>{carriage.plate_number}</Text>
                    <Text style={styles.ownerName}>
                      Owner: {getOwnerName(carriage)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(carriage.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(carriage.status) }]}>
                      {getStatusText(carriage.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.carriageDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={16} color={MUTED} />
                    <Text style={styles.detailText}>Capacity: {carriage.capacity || 4} passengers</Text>
                  </View>
                  {carriage.notes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text" size={16} color={MUTED} />
                      <Text style={styles.detailText}>{carriage.notes}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleDeclineAssignment(carriage.id)}
                    disabled={processingId === carriage.id}
                  >
                    {processingId === carriage.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="close" size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Decline</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAcceptAssignment(carriage.id)}
                    disabled={processingId === carriage.id}
                  >
                    {processingId === carriage.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Assigned Carriages */}
        {assignedCarriages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Carriages ({assignedCarriages.length})</Text>
            {assignedCarriages.map((carriage) => (
              <View key={carriage.id} style={styles.carriageCard}>
                <View style={styles.carriageHeader}>
                  <View style={styles.carriageInfo}>
                    <Text style={styles.plateNumber}>{carriage.plate_number}</Text>
                    <Text style={styles.ownerName}>
                      Owner: {getOwnerName(carriage)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(carriage.status) + '20', alignItems: 'center' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(carriage.status) }]}>
                        {getStatusText(carriage.status)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: carriage.eligibility === 'eligible' ? '#ECFDF5' : '#FEF2F2', alignItems: 'center' }]}>
                      <Text style={[styles.statusText, { 
                        color: carriage.eligibility === 'eligible' ? '#10B981' : '#EF4444' 
                      }]}>
                        {carriage.eligibility === 'eligible' ? 'Eligible' : 'Not Eligible'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.carriageDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={16} color={MUTED} />
                    <Text style={styles.detailText}>Capacity: {carriage.capacity || 4} passengers</Text>
                  </View>
                  {carriage.notes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text" size={16} color={MUTED} />
                      <Text style={styles.detailText}>{carriage.notes}</Text>
                    </View>
                  )}
                </View>

                {carriage.status === 'in_use' && (
                  <View style={styles.inUseBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.inUseBannerText}>Currently In Use</Text>
                  </View>
                )}

                <View style={styles.statusActions}>
                  {carriage.status === 'available' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.selectButton]}
                      onPress={() => handleSelectCarriage(carriage.id)}
                      disabled={selectingCarriage === carriage.id}
                    >
                      {selectingCarriage === carriage.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                          <Text style={[styles.statusButtonText, { color: '#fff' }]}>Select for Use</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {carriage.status === 'in_use' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.availableButton]}
                      onPress={() => handleUpdateCarriageStatus(carriage.id, 'available')}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="close-circle" size={16} color="#fff" />
                          <Text style={[styles.statusButtonText, { color: '#fff' }]}>Set Available</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {carriage.status === 'maintenance' && (
                    <View style={styles.maintenanceBanner}>
                      <Ionicons name="build" size={16} color="#fff" />
                      <Text style={styles.maintenanceBannerText}>Under Maintenance</Text>
                    </View>
                  )}
                  {carriage.status !== 'maintenance' && (
                    <TouchableOpacity
                      style={styles.statusButton}
                      onPress={() => openStatusModal(carriage)}
                    >
                      <Ionicons name={getStatusIcon(carriage.status)} size={16} color={MAROON} />
                      <Text style={styles.statusButtonText}>Change Status</Text>
                    </TouchableOpacity>
                  )}
                  {carriage.status === 'maintenance' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.disabledButton]}
                      disabled={true}
                    >
                      <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                      <Text style={[styles.statusButtonText, { color: '#9CA3AF' }]}>Owner Control Only</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Empty State */}
        {carriages.length === 0 && (
          <View style={styles.emptyState}>
            <Image 
              source={require('../../../assets/carriage-icon.png')} 
              style={styles.emptyStateIcon}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No Carriage Assignments</Text>
            <Text style={styles.emptyText}>
              You don't have any carriage assignments yet. Owners will invite you to drive their carriages.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={statusModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Update Status</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {selectedCarriage && (
              <View style={styles.carriageInfo}>
                <Text style={styles.modalCarriagePlate}>{selectedCarriage.plate_number}</Text>
                <Text style={styles.modalCarriageOwner}>Owner: {getOwnerName(selectedCarriage)}</Text>
              </View>
            )}
            
            <Text style={styles.statusLabel}>Select new status:</Text>
            
            {selectedCarriage?.status === 'maintenance' && (
              <View style={styles.maintenanceNotice}>
                <Ionicons name="information-circle" size={16} color="#F59E0B" />
                <Text style={styles.maintenanceNoticeText}>
                  This carriage is in maintenance mode. Only the owner can change it back to service.
                </Text>
              </View>
            )}
            
            {getAvailableStatuses(selectedCarriage).map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.statusOption,
                  selectedCarriage?.status === status.value && styles.currentStatusOption
                ]}
                onPress={() => handleUpdateCarriageStatus(selectedCarriage.id, status.value)}
                disabled={updatingStatus || selectedCarriage?.status === status.value}
              >
                <View style={styles.statusOptionLeft}>
                  <Ionicons name={status.icon} size={24} color={status.color} />
                  <View style={styles.statusOptionText}>
                    <Text style={styles.statusOptionLabel}>{status.label}</Text>
                    {selectedCarriage?.status === status.value && (
                      <Text style={styles.currentStatusText}>Current Status</Text>
                    )}
                  </View>
                </View>
                {updatingStatus ? (
                  <ActivityIndicator size="small" color={MAROON} />
                ) : (
                  selectedCarriage?.status === status.value && (
                    <Ionicons name="checkmark" size={20} color={status.color} />
                  )
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginTop: -100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 230,
    height: 230,
  },
  loadingTextContainer: {
    marginTop: -120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTextBase: {
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dot: {
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7E3',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    flex: 1,
  },
  refreshHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5E9E2',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  carriageCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  carriageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  carriageInfo: {
    flex: 1,
  },
  plateNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 14,
    color: MUTED,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  carriageDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: TEXT,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: SUCCESS,
  },
  declineButton: {
    backgroundColor: '#C62828',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    opacity: 0.5,
  },
  statusActions: {
    marginTop: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F5E9E2',
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  selectButton: {
    backgroundColor: SUCCESS,
  },
  availableButton: {
    backgroundColor: '#757575',
  },
  inUseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  inUseBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusButtonText: {
    color: MAROON,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7E3',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  cancelButton: {
    color: MUTED,
    fontSize: 16,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalCarriagePlate: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
  },
  modalCarriageOwner: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT,
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  currentStatusOption: {
    backgroundColor: '#F5E9E2',
    borderColor: MAROON,
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusOptionText: {
    marginLeft: 12,
  },
  statusOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT,
  },
  currentStatusText: {
    fontSize: 12,
    color: MAROON,
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Grid layout styles
  carriageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  singleCarriageContainer: {
    paddingHorizontal: 16,
  },
  gridCard: {
    width: '48%',
    marginHorizontal: 0,
    marginBottom: 16,
  },
  fullWidthCard: {
    marginHorizontal: 0,
    marginBottom: 16,
  },
  maintenanceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  maintenanceNoticeText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  maintenanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  maintenanceBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
});
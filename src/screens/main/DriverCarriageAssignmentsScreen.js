import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { getCurrentUser } from '../../services/authService';
import { getCarriagesByDriver, acceptCarriageAssignment, declineCarriageAssignment } from '../../services/api';

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

  useEffect(() => {
    fetchUserAndCarriages();
  }, []);

  const fetchUserAndCarriages = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view assignments');
        return;
      }
      setUser(currentUser);

      const response = await getCarriagesByDriver(currentUser.id);
      if (response.success) {
        setCarriages(response.data || []);
      } else {
        console.error('Failed to fetch carriages:', response.error);
        setCarriages([]);
      }
    } catch (error) {
      console.error('Error fetching carriages:', error);
      Alert.alert('Error', 'Failed to load carriage assignments');
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
        Alert.alert('Success', 'Assignment accepted successfully!');
        await fetchUserAndCarriages();
      } else {
        Alert.alert('Error', response.error || 'Failed to accept assignment');
      }
    } catch (error) {
      console.error('Error accepting assignment:', error);
      Alert.alert('Error', 'Failed to accept assignment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineAssignment = (carriageId) => {
    Alert.alert(
      'Decline Assignment',
      'Are you sure you want to decline this carriage assignment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => confirmDecline(carriageId) }
      ]
    );
  };

  const confirmDecline = async (carriageId) => {
    if (!user) return;
    
    setProcessingId(carriageId);
    try {
      const response = await declineCarriageAssignment(carriageId, user.id);
      if (response.success) {
        Alert.alert('Success', 'Assignment declined');
        await fetchUserAndCarriages();
      } else {
        Alert.alert('Error', response.error || 'Failed to decline assignment');
      }
    } catch (error) {
      console.error('Error declining assignment:', error);
      Alert.alert('Error', 'Failed to decline assignment');
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

  const pendingCarriages = carriages.filter(c => c.status === 'waiting_driver_acceptance');
  const assignedCarriages = carriages.filter(c => c.status === 'driver_assigned');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {!hideHeader && (
          <TARTRACKHeader
            onMessagePress={() => navigation.navigate('Chat')}
            onNotificationPress={() => navigation.navigate('Notification')}
          />
        )}
        <ActivityIndicator size="large" color={MAROON} />
        <Text style={styles.loadingText}>Loading assignments...</Text>
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
        {!hideHeader && (
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={MAROON} />
            </TouchableOpacity>
            <Text style={styles.title}>Carriage Assignments</Text>
          </View>
        )}

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
                      Owner: {carriage.assigned_owner?.name || 'Unknown'}
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
            <Text style={styles.sectionTitle}>My Carriages</Text>
            {assignedCarriages.map((carriage) => (
              <View key={carriage.id} style={styles.carriageCard}>
                <View style={styles.carriageHeader}>
                  <View style={styles.carriageInfo}>
                    <Text style={styles.plateNumber}>{carriage.plate_number}</Text>
                    <Text style={styles.ownerName}>
                      Owner: {carriage.assigned_owner?.name || 'Unknown'}
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
              </View>
            ))}
          </>
        )}

        {/* Empty State */}
        {carriages.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cart-outline" size={64} color={MUTED} />
            <Text style={styles.emptyTitle}>No Carriage Assignments</Text>
            <Text style={styles.emptyText}>
              You don't have any carriage assignments yet. Owners will invite you to drive their carriages.
            </Text>
          </View>
        )}
      </ScrollView>
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
  loadingText: {
    marginTop: 16,
    color: MUTED,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
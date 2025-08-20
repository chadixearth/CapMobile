import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvailableSpecialEventRequestsForOwners, ownerAcceptSpecialEventRequest } from '../../services/specialpackage/customPackageRequest';
import { getCurrentUser } from '../../services/authService';

const MAROON = '#6B2E2B';

export default function OwnerBookScreen({ navigation }) {
  const [availableEvents, setAvailableEvents] = useState([]);
  const [acceptedEvents, setAcceptedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptingEvent, setAcceptingEvent] = useState(false);
  const [activeTab, setActiveTab] = useState('available'); // 'available' or 'history'

  useEffect(() => {
    fetchUserAndEvents();
  }, []);

  const fetchUserAndEvents = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view events');
        setLoading(false);
        return;
      }

      console.log('Current owner user:', currentUser);
      setUser(currentUser);

      // Fetch available special event requests
      await fetchAvailableEvents();
      
      // For history tab, we could add a separate service call here
      // For now, we'll just show available events
    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', `Failed to load events: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableEvents = async () => {
    try {
      console.log('🔍 OwnerBookScreen: Fetching available special event requests...');
      const eventsData = await getAvailableSpecialEventRequestsForOwners();
      console.log('📊 OwnerBookScreen: Events API response:', JSON.stringify(eventsData, null, 2));
      
      if (eventsData && eventsData.success && Array.isArray(eventsData.data)) {
        console.log(`✅ OwnerBookScreen: Found ${eventsData.data.length} special events`);
        setAvailableEvents(eventsData.data);
      } else {
        console.log('❌ OwnerBookScreen: Unexpected events data format:', eventsData);
        console.log('📋 OwnerBookScreen: Response type:', typeof eventsData);
        console.log('📋 OwnerBookScreen: Success flag:', eventsData?.success);
        console.log('📋 OwnerBookScreen: Data type:', typeof eventsData?.data);
        console.log('📋 OwnerBookScreen: Is data array?', Array.isArray(eventsData?.data));
        setAvailableEvents([]);
      }
    } catch (error) {
      console.error('💥 OwnerBookScreen: Error fetching available events:', error);
      console.error('💥 OwnerBookScreen: Error details:', error.message);
      setAvailableEvents([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndEvents();
    setRefreshing(false);
  };

  const handleAcceptEvent = async (event) => {
    setSelectedEvent(event);
    setShowAcceptModal(true);
  };

  const confirmAcceptEvent = async () => {
    if (!selectedEvent || !user) return;

    try {
      setAcceptingEvent(true);
      
      const ownerData = {
        owner_id: user.id,
        owner_name: user.name || user.user_metadata?.name || user.email || 'Owner',
      };

      const result = await ownerAcceptSpecialEventRequest(selectedEvent.id, ownerData);

      console.log('Accept event response:', result);

      if (result.success) {
        Alert.alert('Success', 'Special event request accepted successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowAcceptModal(false);
              setSelectedEvent(null);
              fetchUserAndEvents(); // Refresh the list
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept event request');
      }
    } catch (error) {
      console.error('Error accepting event:', error);
      Alert.alert('Error', `Failed to accept event request: ${error.message}`);
    } finally {
      setAcceptingEvent(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'waiting_for_owner':
        return '#FF9800';
      case 'owner_accepted':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'pending':
        return '#9C27B0';
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'waiting_for_owner':
        return 'time';
      case 'owner_accepted':
        return 'checkmark-circle';
      case 'in_progress':
        return 'play-circle';
      case 'completed':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle';
      case 'pending':
        return 'hourglass';
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      const time = new Date(`2000-01-01T${timeString}`);
      return time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (error) {
      return 'Invalid Time';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `₱${amount.toLocaleString()}`;
  };

  const renderEventCard = (event) => (
    <View key={event.id} style={[styles.eventCard, styles.specialEventCard]}>
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <Text style={styles.eventReference}>
            Event #{event.id.substring(0, 8)}
          </Text>
          <View style={styles.specialEventBadge}>
            <Text style={styles.specialEventBadgeText}>SPECIAL EVENT</Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <Ionicons 
            name={getStatusIcon(event.status)} 
            size={20} 
            color={getStatusColor(event.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(event.status) }]}>
            {event.status?.replace('_', ' ') || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.eventDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Event Type:</Text>
          <Text style={styles.detailValue}>{event.event_type || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Customer:</Text>
          <Text style={styles.detailValue}>{event.customer_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Event Date:</Text>
          <Text style={styles.detailValue}>{formatDate(event.event_date)}</Text>
        </View>
        
        {event.event_time && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event Time:</Text>
            <Text style={styles.detailValue}>{formatTime(event.event_time)}</Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers:</Text>
          <Text style={styles.detailValue}>{event.number_of_pax || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Event Address:</Text>
          <Text style={styles.detailValue}>{event.event_address || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{event.contact_number || 'N/A'}</Text>
        </View>
        
        {event.approved_price_range && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price Range:</Text>
            <Text style={styles.detailValue}>{event.approved_price_range}</Text>
          </View>
        )}
        
        {event.special_requirements && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requirements:</Text>
            <Text style={styles.detailValue}>{event.special_requirements}</Text>
          </View>
        )}
      </View>

      {event.status === 'waiting_for_owner' && activeTab === 'available' && (
        <TouchableOpacity 
          style={[styles.acceptButton, styles.specialEventAcceptButton]}
          onPress={() => handleAcceptEvent(event)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptButtonText}>Accept Event</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={activeTab === 'available' ? "star-outline" : "time-outline"} 
        size={64} 
        color="#ccc" 
      />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'available' ? 'No Available Special Events' : 'No Event History'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {activeTab === 'available' 
          ? 'There are currently no special events waiting for owners. Check back later!'
          : 'You haven\'t accepted any special events yet. Start by accepting available events!'
        }
      </Text>
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={onRefresh}
      >
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'available' && styles.activeTabButton]}
        onPress={() => setActiveTab('available')}
      >
        <Ionicons 
          name="star-outline" 
          size={20} 
          color={activeTab === 'available' ? MAROON : '#666'} 
        />
        <Text style={[styles.tabButtonText, activeTab === 'available' && styles.activeTabButtonText]}>
          Available
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
        onPress={() => setActiveTab('history')}
      >
        <Ionicons 
          name="time-outline" 
          size={20} 
          color={activeTab === 'history' ? MAROON : '#666'} 
        />
        <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>
          History
        </Text>
      </TouchableOpacity>
    </View>
  );

  const currentEvents = activeTab === 'available' ? availableEvents : acceptedEvents;

  // Debug logging
  console.log('🎯 OwnerBookScreen Render State:');
  console.log('📊 Available events count:', availableEvents.length);
  console.log('📊 Current events count:', currentEvents.length);
  console.log('📊 Loading state:', loading);
  console.log('📊 Active tab:', activeTab);
  console.log('📊 Available events:', JSON.stringify(availableEvents, null, 2));

  return (
    <View style={styles.container}>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'available' ? 'Available Special Events' : 'Event History'}
          </Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'Owner'}'s {activeTab === 'available' ? 'available special' : 'accepted'} events
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.refreshButton, { marginLeft: 8, backgroundColor: '#FF5722' }]}
              onPress={async () => {
                console.log('🔧 Manual API test triggered');
                await fetchAvailableEvents();
              }}
            >
              <Text style={styles.refreshButtonText}>Test API</Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderTabBar()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              Loading {activeTab === 'available' ? 'available' : 'accepted'} events...
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {currentEvents.length > 0 ? (
              currentEvents.map(renderEventCard)
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
        )}
      </View>

      {/* Accept Event Modal */}
      <Modal
        visible={showAcceptModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAcceptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accept Special Event</Text>
            <Text style={styles.modalText}>
              Are you sure you want to accept this special event request?
            </Text>
            {selectedEvent && (
              <View style={styles.modalEventInfo}>
                <Text style={styles.modalEventText}>
                  <Text style={styles.modalLabel}>Event Type:</Text> {selectedEvent.event_type}
                </Text>
                <Text style={styles.modalEventText}>
                  <Text style={styles.modalLabel}>Date:</Text> {formatDate(selectedEvent.event_date)}
                </Text>
                <Text style={styles.modalEventText}>
                  <Text style={styles.modalLabel}>Passengers:</Text> {selectedEvent.number_of_pax}
                </Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAcceptModal(false)}
                disabled={acceptingEvent}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton, acceptingEvent && styles.disabledButton]}
                onPress={confirmAcceptEvent}
                disabled={acceptingEvent}
              >
                {acceptingEvent ? (
                  <Text style={styles.confirmButtonText}>Accepting...</Text>
                ) : (
                  <Text style={styles.confirmButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  refreshButton: {
    backgroundColor: MAROON,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  activeTabButtonText: {
    color: MAROON,
  },
  scrollView: {
    flex: 1,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  specialEventCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eventInfo: {
    flex: 1,
  },
  eventReference: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  specialEventBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  specialEventBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  eventDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  specialEventAcceptButton: {
    backgroundColor: '#FF5722',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalEventInfo: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  modalEventText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  modalLabel: {
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#FF5722',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

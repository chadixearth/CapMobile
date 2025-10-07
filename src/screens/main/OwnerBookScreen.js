import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl, // 🟢 pull-to-refresh
  Alert,
  Modal,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import {
  getAvailableSpecialEventRequestsForOwners,
  ownerAcceptSpecialEventRequest,
} from '../../services/specialpackage/customPackageRequest';
import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';

const MAROON = '#6B2E2B';

export default function OwnerBookScreen({ navigation }) {
  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerShown: false });
  }, [navigation]);

  const [availableEvents, setAvailableEvents] = useState([]);
  const [ongoingEvents, setOngoingEvents] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // used for pull-to-refresh & empty-state refresh
  const [user, setUser] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptingEvent, setAcceptingEvent] = useState(false);
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'ongoing' | 'history'

  // Bottom-sheet animation
  const acceptAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(acceptAnim, {
      toValue: showAcceptModal ? 1 : 0,
      duration: 220,
      easing: showAcceptModal ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showAcceptModal, acceptAnim]);

  useEffect(() => {
    fetchUserAndEvents();
  }, []);

  const fetchUserAndEvents = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view events');
        setLoading(false);
        return;
      }
      setUser(currentUser);
      await Promise.all([
        fetchAvailableEvents(),
        fetchOngoingEvents(currentUser.id),
        fetchHistoryEvents(currentUser.id)
      ]);
    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', `Failed to load events: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchOngoingEvents = async (ownerId) => {
    try {
      const { getAllCustomRequests } = require('../../services/specialpackage/customPackageRequest');
      const eventsData = await getAllCustomRequests({ request_type: 'special_event' });
      if (eventsData?.success && Array.isArray(eventsData.data)) {
        const ownerEvents = eventsData.data.filter(event => 
          event.owner_id === ownerId && 
          ['owner_accepted', 'in_progress'].includes(event.status)
        );
        
        // Auto-start events that should be in progress
        const now = new Date();
        const autoStartPromises = ownerEvents.map(async (event) => {
          if (event.status === 'owner_accepted' && event.event_date && event.event_time) {
            const eventDateTime = new Date(`${event.event_date}T${event.event_time}`);
            if (now >= eventDateTime) {
              await updateEventStatus(event.id, 'in_progress');
              return { ...event, status: 'in_progress' };
            }
          }
          return event;
        });
        
        const updatedEvents = await Promise.all(autoStartPromises);
        setOngoingEvents(updatedEvents);
      } else {
        setOngoingEvents([]);
      }
    } catch (error) {
      console.error('Error fetching ongoing events:', error);
      setOngoingEvents([]);
    }
  };

  const fetchHistoryEvents = async (ownerId) => {
    try {
      const { getAllCustomRequests } = require('../../services/specialpackage/customPackageRequest');
      const eventsData = await getAllCustomRequests({ request_type: 'special_event' });
      if (eventsData?.success && Array.isArray(eventsData.data)) {
        const ownerEvents = eventsData.data.filter(event => 
          event.owner_id === ownerId && 
          ['completed', 'cancelled'].includes(event.status)
        );
        setHistoryEvents(ownerEvents);
      } else {
        setHistoryEvents([]);
      }
    } catch (error) {
      console.error('Error fetching history events:', error);
      setHistoryEvents([]);
    }
  };

  const fetchAvailableEvents = async () => {
    try {
      const eventsData = await getAvailableSpecialEventRequestsForOwners();
      if (eventsData?.success && Array.isArray(eventsData.data)) {
        setAvailableEvents(eventsData.data);
      } else {
        setAvailableEvents([]);
      }
    } catch (error) {
      console.error('Error fetching available events:', error);
      setAvailableEvents([]);
    }
  };

  // Pull-to-refresh & empty-state refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndEvents();
    setRefreshing(false);
  };

  const handleAcceptEvent = (event) => {
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
      if (result.success) {
        Alert.alert('Success', 'Special event request accepted successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowAcceptModal(false);
              setSelectedEvent(null);
              fetchUserAndEvents();
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

  const updateEventStatus = async (eventId, newStatus) => {
    try {
      const { updateCustomRequestStatus } = require('../../services/specialpackage/customPackageRequest');
      const result = await updateCustomRequestStatus(eventId, 'special_event', { status: newStatus });
      
      if (result.success) {
        const statusMessages = {
          'in_progress': 'Event started successfully!',
          'completed': 'Event completed successfully!'
        };
        Alert.alert('Success', statusMessages[newStatus] || 'Status updated successfully!');
        fetchUserAndEvents();
      } else {
        Alert.alert('Error', result.error || 'Failed to update event status');
      }
    } catch (error) {
      console.error('Error updating event status:', error);
      Alert.alert('Error', 'Failed to update event status');
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'waiting_for_owner': return '#B26A00';
      case 'owner_accepted':    return '#2E7D32';
      case 'in_progress':       return '#1565C0';
      case 'completed':         return '#2E7D32';
      case 'cancelled':         return '#C62828';
      case 'pending':           return '#7B1FA2';
      case 'approved':          return '#2E7D32';
      case 'rejected':          return '#C62828';
      default:                  return '#555';
    }
  };

  const getStatusIcon = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'waiting_for_owner': return 'time';
      case 'owner_accepted':    return 'checkmark-circle';
      case 'in_progress':       return 'play-circle';
      case 'completed':         return 'checkmark-done-circle';
      case 'cancelled':         return 'close-circle';
      case 'pending':           return 'hourglass';
      case 'approved':          return 'checkmark-circle';
      case 'rejected':          return 'close-circle';
      default:                  return 'help-circle';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString) => (timeString ? timeString : 'N/A');

  const getConversationType = (event) => {
    return 'special_event_request';
  };

  const renderEventCard = (event) => (
    <View key={event.id} style={[styles.bookingCard, styles.specialEventCard]}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingReference}>Event #{String(event.id).substring(0, 8)}</Text>
          <View style={styles.specialEventBadge}>
            <Text style={styles.specialEventBadgeText}>SPECIAL</Text>
          </View>
        </View>
        <View style={[styles.statusContainer, { borderColor: getStatusColor(event.status) }]}>
          <Ionicons name={getStatusIcon(event.status)} size={16} color={getStatusColor(event.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(event.status) }]}>
            {(event.status || 'Unknown').replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
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

        {event.event_time ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event Time:</Text>
            <Text style={styles.detailValue}>{formatTime(event.event_time)}</Text>
          </View>
        ) : null}

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

        {event.approved_price_range ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price Range:</Text>
            <Text style={styles.detailValue}>{event.approved_price_range}</Text>
          </View>
        ) : null}

        {event.special_requirements ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requirements:</Text>
            <Text style={styles.detailValue}>{event.special_requirements}</Text>
          </View>
        ) : null}
      </View>

      {event.status === 'waiting_for_owner' && activeTab === 'available' && (
        <TouchableOpacity
          style={[styles.acceptButton, styles.specialEventAcceptButton]}
          onPress={() => handleAcceptEvent(event)}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.acceptButtonText}>Accept Event</Text>
        </TouchableOpacity>
      )}
      
      {event.status === 'owner_accepted' && activeTab === 'ongoing' && (
        <>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: '#1565C0' }]}
            onPress={() => updateEventStatus(event.id, 'in_progress')}
          >
            <Ionicons name="play-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Start Event</Text>
          </TouchableOpacity>
          
          {/* Add message button */}
          <TouchableOpacity 
            style={[styles.acceptButton, styles.messageBtn]} 
            onPress={async () => {
              try {
                // Get customer profile first
                const customer = await getTouristProfile(event.customer_id);
                
                navigation.navigate('Communication', {
                  screen: 'ChatRoom',
                  params: { 
                    bookingId: event.id,
                    subject: `Special Event: ${event.event_type || 'Event'}`,
                    participantRole: 'owner',
                    requestType: 'special_event_request',
                    packageId: null,
                    eventId: event.special_event_request_id || null,
                    contactName: customer?.name || event.customer_name || 'Customer',
                    userRole: 'owner'
                  }
                });
              } catch (error) {
                console.error('Error getting customer info:', error);
                // Fallback navigation if customer lookup fails
                navigation.navigate('Communication', {
                  screen: 'ChatRoom',
                  params: {
                    bookingId: event.id,
                    subject: `Special Event: ${event.event_type || 'Event'}`,
                    participantRole: 'owner',
                    requestType: 'special_event_request',
                    packageId: null,
                    eventId: event.special_event_request_id || null,
                    contactName: event.customer_name || 'Customer',
                    userRole: 'owner'
                  }
                });
              }
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Message Customer</Text>
          </TouchableOpacity>
        </>
      )}
      
      {event.status === 'in_progress' && activeTab === 'ongoing' && (
        <>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => handleCompleteEvent(event)}
          >
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Complete with Photo</Text>
          </TouchableOpacity>
          
          {/* Add message button for in-progress events */}
          <TouchableOpacity 
            style={[styles.acceptButton, styles.messageBtn]} 
            onPress={async () => {
              try {
                // Get customer profile first
                const customer = await getTouristProfile(event.customer_id);
                
                navigation.navigate('Communication', {
                  screen: 'ChatRoom',
                  params: { 
                    bookingId: event.id,
                    subject: `Special Event: ${event.event_type || 'Event'}`,
                    participantRole: 'owner',
                    requestType: 'special_event_request',
                    packageId: null,
                    eventId: event.special_event_request_id || null,
                    contactName: customer?.name || event.customer_name || 'Customer',
                    userRole: 'owner'
                  }
                });
              } catch (error) {
                console.error('Error getting customer info:', error);
                // Fallback navigation if customer lookup fails
                navigation.navigate('Communication', {
                  screen: 'ChatRoom',
                  params: {
                    bookingId: event.id,
                    subject: `Special Event: ${event.event_type || 'Event'}`,
                    participantRole: 'owner',
                    requestType: 'special_event_request',
                    packageId: null,
                    eventId: event.special_event_request_id || null,
                    contactName: event.customer_name || 'Customer',
                    userRole: 'owner'
                  }
                });
              }
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Message Customer</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
  const getTouristProfile = async (customerId) => {
    if (!customerId || customerId === 'undefined') {
      console.warn('No valid customerId provided');
      return { id: null, name: 'Tourist' };
    }

    const { data, error } = await supabase
      .from('public_user_profiles')
      .select('id, name')
      .eq('id', customerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching tourist profile:', error);
      return { id: customerId, name: 'Tourist' };
    }
    return data || { id: customerId, name: 'Tourist' };
  };

  const renderEmptyState = () => {
    const getEmptyStateConfig = () => {
      switch (activeTab) {
        case 'available':
          return {
            icon: 'star-outline',
            title: 'No Available Special Events',
            subtitle: 'There are currently no special events waiting for owners. Check back later!'
          };
        case 'ongoing':
          return {
            icon: 'play-circle-outline',
            title: 'No Ongoing Events',
            subtitle: 'You have no events in progress. Accept available events to get started!'
          };
        case 'history':
          return {
            icon: 'time-outline',
            title: 'No Event History',
            subtitle: 'Your completed and cancelled events will appear here.'
          };
        default:
          return { icon: 'star-outline', title: 'No Events', subtitle: '' };
      }
    };
    
    const config = getEmptyStateConfig();
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name={config.icon} size={64} color="#C9C9C9" />
        <Text style={styles.emptyStateTitle}>{config.title}</Text>
        <Text style={styles.emptyStateSubtitle}>{config.subtitle}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'available' && styles.activeTabButton]}
        onPress={() => setActiveTab('available')}
      >
        <Ionicons name="star-outline" size={16} color={activeTab === 'available' ? MAROON : '#777'} />
        <Text style={[styles.tabButtonText, activeTab === 'available' && styles.activeTabButtonText]}>Available</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'ongoing' && styles.activeTabButton]}
        onPress={() => setActiveTab('ongoing')}
      >
        <Ionicons name="play-circle-outline" size={16} color={activeTab === 'ongoing' ? MAROON : '#777'} />
        <Text style={[styles.tabButtonText, activeTab === 'ongoing' && styles.activeTabButtonText]}>Ongoing</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
        onPress={() => setActiveTab('history')}
      >
        <Ionicons name="time-outline" size={16} color={activeTab === 'history' ? MAROON : '#777'} />
        <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>History</Text>
      </TouchableOpacity>
    </View>
  );

  const getCurrentEvents = () => {
    switch (activeTab) {
      case 'available': return availableEvents;
      case 'ongoing': return ongoingEvents;
      case 'history': return historyEvents;
      default: return [];
    }
  };
  
  const currentEvents = getCurrentEvents();

  const handleCompleteEvent = (event) => {
    navigation.navigate('CompletionPhotoScreen', {
      eventId: event.id,
      eventType: 'special_event',
      eventDetails: {
        event_type: event.event_type,
        customer_name: event.customer_name,
        event_date: event.event_date,
        event_time: event.event_time
      },
      onComplete: () => {
        fetchUserAndEvents();
      }
    });
  };

  const acceptTranslateY = acceptAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const acceptOpacity = acceptAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.container}>
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'available' ? 'Available Special Events' : 
             activeTab === 'ongoing' ? 'Ongoing Events' : 'Event History'}
          </Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'Owner'}
            {'\u2019'}s {activeTab === 'available' ? 'available' : 
                        activeTab === 'ongoing' ? 'ongoing' : 'completed'} events
          </Text>

          {/* header refresh button removed */}
          <View style={styles.headerButtons} />
        </View>

        {renderTabBar()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              Loading {activeTab === 'available' ? 'available' : 'history'} events...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            // 🟢 Pull-to-refresh restored
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {currentEvents.length > 0 ? currentEvents.map(renderEventCard) : renderEmptyState()}
          </ScrollView>
        )}
      </View>

      {/* Accept Event – bottom-sheet modal */}
      <Modal
        visible={showAcceptModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAcceptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !acceptingEvent && setShowAcceptModal(false)}
          />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: acceptTranslateY }], opacity: acceptOpacity },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Accept Special Event</Text>
              <TouchableOpacity
                onPress={() => !acceptingEvent && setShowAcceptModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Are you sure you want to accept this special event request?
            </Text>

            {selectedEvent && (
              <View style={styles.modalBookingInfo}>
                <Text style={styles.modalBookingText}>
                  <Text style={styles.modalLabel}>Event Type: </Text>
                  {selectedEvent.event_type || 'N/A'}
                </Text>
                <Text style={styles.modalBookingText}>
                  <Text style={styles.modalLabel}>Date: </Text>
                  {formatDate(selectedEvent.event_date)}
                </Text>
                <Text style={styles.modalBookingText}>
                  <Text style={styles.modalLabel}>Passengers: </Text>
                  {selectedEvent.number_of_pax || 'N/A'}
                </Text>
              </View>
            )}

            <View style={styles.sheetButtons}>
              <TouchableOpacity
                style={[styles.btnSecondary, acceptingEvent && styles.disabledButton]}
                onPress={() => setShowAcceptModal(false)}
                disabled={acceptingEvent}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, acceptingEvent && styles.disabledButton]}
                onPress={confirmAcceptEvent}
                disabled={acceptingEvent}
              >
                <Text style={styles.btnPrimaryText}>
                  {acceptingEvent ? 'Accepting...' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Styles mirrored from DriverBookScreen ---------- */
const styles = StyleSheet.create({
  /* Page */
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { flex: 1, paddingHorizontal: 16 },

  /* Header */
  header: { paddingVertical: 18, alignItems: 'center' },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
    marginBottom: 6,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: { fontSize: 12, color: '#777', textAlign: 'center', marginBottom: 10 },
  headerButtons: { flexDirection: 'row', marginTop: 6 },

  /* Tabs */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE7E6',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTabButton: { backgroundColor: 'rgba(107,46,43,0.10)' },
  tabButtonText: { fontSize: 13, fontWeight: '700', color: '#777', marginLeft: 8 },
  activeTabButtonText: { color: '#6B2E2B' },

  /* List */
  scrollView: { flex: 1 },

  /* Card */
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE7E6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  specialEventCard: { borderLeftWidth: 4, borderLeftColor: '#FF5722' },

  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEE',
  },
  bookingInfo: { flex: 1, paddingRight: 8 },
  bookingReference: { fontSize: 14, fontWeight: '800', color: '#222', marginBottom: 2 },

  specialEventBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  specialEventBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7F7F7',
  },
  statusText: { fontSize: 12, fontWeight: '800' },

  bookingDetails: { gap: 8, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: 13, color: '#777', fontWeight: '600', flex: 1, paddingRight: 10 },
  detailValue: { fontSize: 13, color: '#222', flex: 2, textAlign: 'right' },

  /* Buttons */
  acceptButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  specialEventAcceptButton: { backgroundColor: '#FF5722' },
  messageBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  /* Loading */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#777' },

  /* Empty */
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 56 },
  emptyStateTitle: { fontSize: 18, fontWeight: '800', color: '#222', marginTop: 12, marginBottom: 6 },
  emptyStateSubtitle: { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 18, paddingHorizontal: 20 },

  /* Header small button style (used only in empty-state) */
  refreshButton: {
    backgroundColor: MAROON,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  refreshButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  /* Bottom-sheet Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#EDE7E6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E7E2E1',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#222', textAlign: 'center', flex: 1 },
  modalText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 12 },

  modalBookingInfo: {
    backgroundColor: '#FAF7F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDE7E6',
  },
  modalBookingText: { fontSize: 13, color: '#222', marginBottom: 4 },
  modalLabel: { fontWeight: '800' },

  sheetButtons: { flexDirection: 'row', gap: 10 },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0DFDF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#333', fontSize: 14, fontWeight: '800' },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
});

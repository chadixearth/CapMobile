import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { getAllCustomRequests } from '../../services/specialpackage/customPackageRequest';

const MAROON = '#6B2E2B';

export default function OwnerScheduleScreen({ navigation }) {
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { user } = useAuth();
  const [calendar, setCalendar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const loadCalendar = async () => {
    if (!user?.id) return;
    
    try {
      // Get all special events accepted by this owner
      const result = await getAllCustomRequests({ request_type: 'special_event' });
      
      if (result.success) {
        // Filter events accepted by this owner (include cancelled for history)
        const ownerEvents = result.data.filter(event => 
          event.owner_id === user.id && 
          ['owner_accepted', 'in_progress', 'completed', 'cancelled'].includes(event.status)
        );
        setCalendar(ownerEvents);
      } else {
        setCalendar([]);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error loading schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [user?.id, currentDate]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCalendar();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'All Day';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const hasEventOnDate = (day) => {
    if (!day) return false;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendar.some(event => event.event_date === dateStr);
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendar.filter(event => event.event_date === dateStr);
  };

  const getDateStatus = (day) => {
    if (!day) return 'empty';
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const selectedDateObj = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hasEvent = hasEventOnDate(day);
    const events = getEventsForDate(day);
    
    if (selectedDateObj < today) {
      return hasEvent ? 'pastWithEvent' : 'past';
    }
    
    if (hasEvent) {
      const hasInProgress = events.some(e => e.status === 'in_progress');
      const hasCompleted = events.some(e => e.status === 'completed');
      
      if (hasInProgress) return 'inProgress';
      if (hasCompleted) return 'completed';
      return 'scheduled';
    }
    
    return 'available';
  };

  const handleDatePress = (day) => {
    if (!day) return;
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = getEventsForDate(day);
    
    setSelectedDate({ day, events, dateStr });
    setShowModal(true);
  };

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'owner_accepted': return '#2E7D32';
      case 'in_progress': return '#1565C0';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#D32F2F';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MAROON} />
        <Text style={styles.loadingText}>Loading your schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Month Navigation */}
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color={MAROON} />
          </TouchableOpacity>
          <View style={styles.monthTitleContainer}>
            <Text style={styles.monthTitle}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.monthSubtitle}>
              {calendar.length} event{calendar.length !== 1 ? 's' : ''} scheduled
            </Text>
          </View>
          <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={20} color={MAROON} />
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          {/* Day Headers */}
          <View style={styles.dayHeaders}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <View key={index} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeader}>{day}</Text>
              </View>
            ))}
          </View>
          
          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {getDaysInMonth().map((day, index) => {
              const isToday = day && 
                new Date().getDate() === day && 
                new Date().getMonth() === currentDate.getMonth() && 
                new Date().getFullYear() === currentDate.getFullYear();
              const dateStatus = getDateStatus(day);
              const eventCount = getEventsForDate(day).length;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    dateStatus === 'scheduled' && styles.dayScheduled,
                    dateStatus === 'inProgress' && styles.dayInProgress,
                    dateStatus === 'completed' && styles.dayCompleted,
                    dateStatus === 'pastWithEvent' && styles.dayPastWithEvent,
                    dateStatus === 'past' && styles.dayPast,
                    isToday && styles.todayCell
                  ]}
                  onPress={() => handleDatePress(day)}
                  disabled={!day}
                  activeOpacity={0.7}
                >
                  {day && (
                    <>
                      <Text style={[
                        styles.dayText,
                        (dateStatus === 'scheduled' || dateStatus === 'inProgress' || dateStatus === 'completed') && styles.dayTextContrast,
                        dateStatus === 'past' && styles.dayTextPast,
                        isToday && styles.todayText
                      ]}>
                        {day}
                      </Text>
                      {eventCount > 0 && (
                        <View style={styles.eventIndicator}>
                          <Text style={styles.eventCount}>{eventCount}</Text>
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Legend:</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#2E7D32' }]} />
                <Text style={styles.legendText}>Scheduled</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#1565C0' }]} />
                <Text style={styles.legendText}>In Progress</Text>
              </View>
            </View>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Completed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#8d6e63', opacity: 0.8 }]} />
                <Text style={styles.legendText}>Past Events</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Event Details Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate && `${currentDate.toLocaleDateString('en-US', { month: 'long' })} ${selectedDate.day}`}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalEvents} showsVerticalScrollIndicator={false}>
              {selectedDate?.events.length > 0 ? selectedDate.events.map((event, index) => (
                <View key={event.id} style={styles.modalEventCard}>
                  <View style={styles.modalEventHeader}>
                    <View style={styles.timeContainer}>
                      <Ionicons name="time-outline" size={16} color={MAROON} />
                      <Text style={styles.modalTimeText}>{formatTime(event.event_time)}</Text>
                    </View>
                    <View style={[
                      styles.modalStatusBadge,
                      { backgroundColor: getStatusColor(event.status) }
                    ]}>
                      <Text style={styles.modalStatusText}>
                        {event.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.modalEventType}>{event.event_type}</Text>
                  <View style={styles.customerContainer}>
                    <Ionicons name="person-outline" size={14} color="#666" />
                    <Text style={styles.modalCustomerName}>{event.customer_name}</Text>
                  </View>
                  <View style={styles.locationContainer}>
                    <Ionicons name="location-outline" size={14} color="#666" />
                    <Text style={styles.modalLocationText}>{event.event_address}</Text>
                  </View>
                  <View style={styles.paxContainer}>
                    <Ionicons name="people-outline" size={14} color="#666" />
                    <Text style={styles.modalPaxText}>{event.number_of_pax} passengers</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.modalViewBtn}
                    onPress={() => {
                      setShowModal(false);
                      navigation.navigate('Events');
                    }}
                  >
                    <Text style={styles.modalViewText}>View Full Details</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )) : (
                <View style={styles.noEventsContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#ccc" />
                  <Text style={styles.noEventsText}>No events for this date</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8'
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16
  },
  content: {
    flex: 1,
    padding: 16
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center'
  },
  monthTitleContainer: {
    alignItems: 'center'
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2
  },
  monthSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 12
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center'
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textAlign: 'center'
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 2
  },
  dayScheduled: {
    backgroundColor: '#2E7D32',
    borderRadius: 12
  },
  dayInProgress: {
    backgroundColor: '#1565C0',
    borderRadius: 12
  },
  dayCompleted: {
    backgroundColor: '#4CAF50',
    borderRadius: 12
  },
  dayPastWithEvent: {
    backgroundColor: '#8d6e63',
    borderRadius: 12,
    opacity: 0.8
  },
  dayPast: {
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    opacity: 0.5
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#FF5722',
    borderRadius: 12
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333'
  },
  dayTextContrast: {
    color: '#fff',
    fontWeight: '700'
  },
  dayTextPast: {
    color: '#999',
    fontWeight: '400'
  },
  todayText: {
    color: '#FF5722',
    fontWeight: '700'
  },
  eventIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  eventCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF5722'
  },
  legendContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  legendItems: {
    flex: 1
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333'
  },
  modalEvents: {
    padding: 24
  },
  modalEventCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722'
  },
  modalEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  modalTimeText: {
    fontSize: 16,
    fontWeight: '700',
    color: MAROON,
    marginLeft: 6
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff'
  },
  modalEventType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  customerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  modalCustomerName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  modalLocationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    flex: 1
  },
  paxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  modalPaxText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6
  },
  modalViewBtn: {
    backgroundColor: MAROON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12
  },
  modalViewText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 8
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  noEventsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12
  }
});
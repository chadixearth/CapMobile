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
import { driverScheduleService } from '../../services/driverScheduleService';

const MAROON = '#6B2E2B';

export default function DriverScheduleScreen({ navigation }) {
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
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const result = await driverScheduleService.getDriverCalendar(user.id, startOfMonth, endOfMonth);
      
      if (result.success) {
        setCalendar(result.data || []);
      } else {
        Alert.alert('Error', 'Failed to load calendar');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error loading calendar');
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
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const hasBookingOnDate = (day) => {
    if (!day) return false;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendar.some(booking => booking.booking_date === dateStr);
  };

  const getBookingsForDate = (day) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendar.filter(booking => booking.booking_date === dateStr);
  };

  const handleDatePress = (day) => {
    if (!day) return;
    const bookings = getBookingsForDate(day);
    if (bookings.length > 0) {
      setSelectedDate({ day, bookings });
      setShowModal(true);
    }
  };

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SetAvailability')}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

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
              {calendar.length} booking{calendar.length !== 1 ? 's' : ''} this month
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
              const hasBooking = hasBookingOnDate(day);
              const bookingCount = getBookingsForDate(day).length;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    hasBooking && styles.dayWithBooking,
                    isToday && styles.todayCell
                  ]}
                  onPress={() => handleDatePress(day)}
                  disabled={!day || !hasBooking}
                  activeOpacity={hasBooking ? 0.7 : 1}
                >
                  {day && (
                    <>
                      <Text style={[
                        styles.dayText,
                        hasBooking && styles.dayTextWithBooking,
                        isToday && styles.todayText
                      ]}>
                        {day}
                      </Text>
                      {hasBooking && (
                        <View style={styles.bookingIndicator}>
                          <Text style={styles.bookingCount}>{bookingCount}</Text>
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Set Availability Button */}
        <TouchableOpacity 
          style={styles.availabilityBtn}
          onPress={() => navigation.navigate('SetAvailability')}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.availabilityBtnText}>Set Availability</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Booking Details Modal */}
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
            
            <ScrollView style={styles.modalBookings} showsVerticalScrollIndicator={false}>
              {selectedDate?.bookings.map((booking, index) => (
                <View key={booking.id} style={styles.modalBookingCard}>
                  <View style={styles.modalBookingHeader}>
                    <View style={styles.timeContainer}>
                      <Ionicons name="time-outline" size={16} color={MAROON} />
                      <Text style={styles.modalTimeText}>{formatTime(booking.booking_time)}</Text>
                    </View>
                    <View style={[
                      styles.modalStatusBadge,
                      booking.status === 'confirmed' && styles.confirmedBadge,
                      booking.status === 'cancelled' && styles.cancelledBadge
                    ]}>
                      <Text style={[
                        styles.modalStatusText,
                        booking.status === 'confirmed' && styles.confirmedText,
                        booking.status === 'cancelled' && styles.cancelledText
                      ]}>
                        {booking.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.modalPackageName}>{booking.package_name}</Text>
                  <View style={styles.customerContainer}>
                    <Ionicons name="person-outline" size={14} color="#666" />
                    <Text style={styles.modalCustomerName}>{booking.customer_name}</Text>
                  </View>
                  
                  {booking.status === 'confirmed' && (
                    <TouchableOpacity 
                      style={styles.modalViewBtn}
                      onPress={() => {
                        setShowModal(false);
                        navigation.navigate('Bookings');
                      }}
                    >
                      <Text style={styles.modalViewText}>View Full Details</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
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
  header: {
    backgroundColor: MAROON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
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
  dayWithBooking: {
    backgroundColor: MAROON,
    borderRadius: 12,
    elevation: 2,
    shadowColor: MAROON,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333'
  },
  dayTextWithBooking: {
    color: '#fff',
    fontWeight: '700'
  },
  todayText: {
    color: '#4CAF50',
    fontWeight: '700'
  },
  bookingIndicator: {
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
  bookingCount: {
    fontSize: 10,
    fontWeight: '700',
    color: MAROON
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
  modalBookings: {
    padding: 24
  },
  modalBookingCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: MAROON
  },
  modalBookingHeader: {
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
    borderRadius: 20,
    backgroundColor: '#f0f0f0'
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666'
  },
  modalPackageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  customerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  modalCustomerName: {
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
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  bookingDate: {
    flex: 1
  },
  timeText: {
    fontSize: 14,
    color: MAROON,
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0'
  },
  confirmedBadge: {
    backgroundColor: '#e8f5e8'
  },
  cancelledBadge: {
    backgroundColor: '#ffeaea'
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666'
  },
  confirmedText: {
    color: '#2e7d32'
  },
  cancelledText: {
    color: '#d32f2f'
  },
  packageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    marginTop: 8
  },
  customerName: {
    fontSize: 14,
    color: '#666'
  },
  viewBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8
  },
  viewBookingText: {
    color: MAROON,
    fontWeight: '500',
    marginRight: 4
  },
  availabilityBtn: {
    backgroundColor: MAROON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 40,
    elevation: 3,
    shadowColor: MAROON,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  availabilityBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8
  }
});
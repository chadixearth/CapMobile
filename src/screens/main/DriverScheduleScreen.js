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
import TARTRACKHeader from '../../components/TARTRACKHeader';

const MAROON = '#6B2E2B';

export default function DriverScheduleScreen({ navigation }) {
  // Hide the default stack header (avoid double headers)
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { user } = useAuth();
  const [calendar, setCalendar] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [availabilityMode, setAvailabilityMode] = useState('range'); // 'range' or 'custom'
  const [availableFromTime, setAvailableFromTime] = useState('08:00');
  const [availableToTime, setAvailableToTime] = useState('18:00');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([]);

  const loadCalendar = async () => {
    if (!user?.id) return;
    
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      // Load both calendar bookings and schedule availability
      const [calendarResult, scheduleResult] = await Promise.all([
        driverScheduleService.getDriverCalendar(user.id, startOfMonth, endOfMonth),
        driverScheduleService.getDriverSchedule(user.id, startOfMonth, endOfMonth)
      ]);
      
      if (calendarResult.success) {
        setCalendar(calendarResult.data || []);
      }
      
      if (scheduleResult.success) {
        setSchedule(scheduleResult.data || []);
      }
      
      if (!calendarResult.success && !scheduleResult.success) {
        Alert.alert('Error', 'Failed to load schedule data');
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

  const getAvailabilityForDate = (day) => {
    if (!day) return null;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedule.find(s => s.date === dateStr);
  };

  const getDateStatus = (day) => {
    if (!day) return 'empty';
    
    // Check if date is in the past
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const selectedDateObj = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hasBooking = hasBookingOnDate(day);
    const availability = getAvailabilityForDate(day);
    
    if (selectedDateObj < today) {
      // Past dates: distinguish between those with bookings and without
      return hasBooking ? 'pastWithBooking' : 'past';
    }
    
    if (hasBooking) return 'booked';
    if (availability) {
      if (!availability.is_available) return 'unavailable';
      if (availability.unavailable_times?.length > 0) return 'partial';
      return 'available';
    }
    return 'unset'; // No availability set
  };

  const handleDatePress = (day) => {
    if (!day) return;
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const selectedDateObj = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookings = getBookingsForDate(day);
    const availability = getAvailabilityForDate(day);
    const isPastDate = selectedDateObj < today;
    
    // Allow viewing past dates if they have bookings (completed trips)
    if (isPastDate && bookings.length === 0) {
      Alert.alert('Past Date', 'No bookings to view for this past date.');
      return;
    }
    
    setSelectedDate({ day, bookings, availability, dateStr, isPastDate });
    setShowModal(true);
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
              {calendar.length} booking{calendar.length !== 1 ? 's' : ''} • {schedule.length} day{schedule.length !== 1 ? 's' : ''} scheduled
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
              const bookingCount = getBookingsForDate(day).length;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    dateStatus === 'booked' && styles.dayWithBooking,
                    dateStatus === 'available' && styles.dayAvailable,
                    dateStatus === 'unavailable' && styles.dayUnavailable,
                    dateStatus === 'partial' && styles.dayPartial,
                    dateStatus === 'unset' && styles.dayUnset,
                    dateStatus === 'past' && styles.dayPast,
                    dateStatus === 'pastWithBooking' && styles.dayPastWithBooking,
                    isToday && styles.todayCell
                  ]}
                  onPress={() => handleDatePress(day)}
                  disabled={!day || dateStatus === 'past'}
                  activeOpacity={dateStatus === 'past' ? 1 : 0.7}
                >
                  {day && (
                    <>
                      <Text style={[
                        styles.dayText,
                        (dateStatus === 'booked' || dateStatus === 'unavailable') && styles.dayTextContrast,
                        dateStatus === 'available' && styles.dayTextAvailable,
                        dateStatus === 'partial' && styles.dayTextPartial,
                        dateStatus === 'past' && styles.dayTextPast,
                        dateStatus === 'pastWithBooking' && styles.dayTextPastWithBooking,
                        isToday && styles.todayText
                      ]}>
                        {day}
                      </Text>
                      {dateStatus === 'booked' && (
                        <View style={styles.bookingIndicator}>
                          <Text style={styles.bookingCount}>{bookingCount}</Text>
                        </View>
                      )}
                      {dateStatus === 'partial' && (
                        <View style={styles.partialIndicator}>
                          <Text style={styles.partialText}>~</Text>
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
                <View style={[styles.legendColor, { backgroundColor: MAROON }]} />
                <Text style={styles.legendText}>Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#f44336' }]} />
                <Text style={styles.legendText}>Unavailable</Text>
              </View>
            </View>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.legendText}>Partial</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' }]} />
                <Text style={styles.legendText}>Not Set</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#8d6e63', opacity: 0.8 }]} />
                <Text style={styles.legendText}>Past Bookings</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#e0e0e0', opacity: 0.5 }]} />
                <Text style={styles.legendText}>Past (Empty)</Text>
              </View>
            </View>
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
            
            {/* Availability Status */}
            {selectedDate?.availability && (
              <View style={styles.availabilityStatus}>
                <View style={styles.statusHeader}>
                  <Ionicons 
                    name={selectedDate.availability.is_available ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={selectedDate.availability.is_available ? "#4CAF50" : "#f44336"} 
                  />
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusText}>
                      {selectedDate.availability.is_available ? 'Available' : 'Unavailable'}
                    </Text>
                    {selectedDate.availability.is_available && selectedDate.availability.unavailable_times?.length > 0 && (() => {
                      // Calculate available time range from unavailable times
                      const allTimes = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
                      const unavailable = selectedDate.availability.unavailable_times;
                      const available = allTimes.filter(time => !unavailable.includes(time));
                      
                      if (available.length > 0) {
                        const startTime = available[0];
                        const endTime = available[available.length - 1];
                        const endHour = parseInt(endTime.split(':')[0]) + 1;
                        const endTimeFormatted = `${endHour.toString().padStart(2, '0')}:00`;
                        
                        return (
                          <Text style={styles.timeRangeText}>
                            {formatTime(startTime)} - {formatTime(endTimeFormatted)}
                          </Text>
                        );
                      }
                      return null;
                    })()}
                  </View>
                </View>
                
                {selectedDate.availability.unavailable_times?.length > 0 && (
                  <View style={styles.unavailableTimes}>
                    <Text style={styles.unavailableLabel}>Unavailable times:</Text>
                    <Text style={styles.unavailableTimesList}>
                      {selectedDate.availability.unavailable_times.join(', ')}
                    </Text>
                  </View>
                )}
                
                {selectedDate.availability.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Notes:</Text>
                    <Text style={styles.notesText}>{selectedDate.availability.notes}</Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Quick Availability Actions - Only for future dates */}
            {selectedDate && !selectedDate.isPastDate && (
              <View style={styles.quickActions}>
                {!selectedDate.availability ? (
                  // No availability set - show quick options
                  <>
                    <TouchableOpacity 
                      style={[styles.quickActionBtn, styles.availableBtn]}
                      onPress={() => {
                        // Reset modal states
                        setAvailabilityMode('range');
                        setSelectedTimeSlots([]);
                        setAvailableFromTime('08:00');
                        setAvailableToTime('18:00');
                        setShowTimeModal(true);
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                      <Text style={[styles.quickActionText, { color: '#4CAF50' }]}>Set Available Hours</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.quickActionBtn, styles.unavailableBtn]}
                      onPress={async () => {
                        try {
                          await driverScheduleService.setAvailability(
                            user.id, 
                            selectedDate.dateStr, 
                            false, 
                            [], 
                            'Marked unavailable from calendar'
                          );
                          setShowModal(false);
                          onRefresh();
                        } catch (error) {
                          Alert.alert('Error', 'Failed to update availability');
                        }
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#d32f2f" />
                      <Text style={[styles.quickActionText, { color: '#d32f2f' }]}>Mark Unavailable</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // Availability already set - show edit option
                  <TouchableOpacity 
                    style={styles.quickActionBtn}
                    onPress={() => {
                      setShowModal(false);
                      navigation.navigate('SetAvailability', { selectedDate: selectedDate.dateStr });
                    }}
                  >
                    <Ionicons name="calendar-outline" size={16} color={MAROON} />
                    <Text style={styles.quickActionText}>Edit Availability</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            {/* Past Date Notice */}
            {selectedDate?.isPastDate && (
              <View style={styles.pastDateNotice}>
                <Ionicons name="information-circle-outline" size={20} color="#666" />
                <Text style={styles.pastDateNoticeText}>
                  This is a past date. You can view completed bookings but cannot modify availability.
                </Text>
              </View>
            )}
            
            <ScrollView style={styles.modalBookings} showsVerticalScrollIndicator={false}>
              {selectedDate?.bookings.length > 0 ? selectedDate.bookings.map((booking, index) => (
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
              )) : (
                <View style={styles.noBookingsContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#ccc" />
                  <Text style={styles.noBookingsText}>No bookings for this date</Text>
                  <Text style={styles.noBookingsSubtext}>Tap "Set Availability" to manage your schedule</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Selection Modal */}
      <Modal
        visible={showTimeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Available Hours</Text>
              <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.timeSelectionContainer}>
              <Text style={styles.timeSelectionTitle}>
                {selectedDate && `${new Date(selectedDate.dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
              </Text>
              
              {/* Mode Selection */}
              <View style={styles.modeSelection}>
                <TouchableOpacity 
                  style={[styles.modeBtn, availabilityMode === 'range' && styles.modeBtnActive]}
                  onPress={() => setAvailabilityMode('range')}
                >
                  <Ionicons name="time-outline" size={16} color={availabilityMode === 'range' ? '#fff' : MAROON} />
                  <Text style={[styles.modeBtnText, availabilityMode === 'range' && styles.modeBtnTextActive]}>Time Range</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modeBtn, availabilityMode === 'custom' && styles.modeBtnActive]}
                  onPress={() => setAvailabilityMode('custom')}
                >
                  <Ionicons name="grid-outline" size={16} color={availabilityMode === 'custom' ? '#fff' : MAROON} />
                  <Text style={[styles.modeBtnText, availabilityMode === 'custom' && styles.modeBtnTextActive]}>Select Hours</Text>
                </TouchableOpacity>
              </View>
              
              {availabilityMode === 'range' ? (
                <>
                  <View style={styles.timeRow}>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>From:</Text>
                      <TouchableOpacity style={styles.timeInput}>
                        <Text style={styles.timeInputText}>{formatTime(availableFromTime)}</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>To:</Text>
                      <TouchableOpacity style={styles.timeInput}>
                        <Text style={styles.timeInputText}>{formatTime(availableToTime)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {/* Quick Time Presets */}
                  <View style={styles.presetsContainer}>
                    <Text style={styles.presetsTitle}>Quick Presets:</Text>
                    <View style={styles.presetsRow}>
                      <TouchableOpacity 
                        style={styles.presetBtn}
                        onPress={() => {
                          setAvailableFromTime('08:00');
                          setAvailableToTime('17:00');
                        }}
                      >
                        <Text style={styles.presetText}>8AM - 5PM</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.presetBtn}
                        onPress={() => {
                          setAvailableFromTime('09:00');
                          setAvailableToTime('18:00');
                        }}
                      >
                        <Text style={styles.presetText}>9AM - 6PM</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.presetBtn}
                        onPress={() => {
                          setAvailableFromTime('06:00');
                          setAvailableToTime('20:00');
                        }}
                      >
                        <Text style={styles.presetText}>6AM - 8PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.customModeTitle}>Select specific hours you're available:</Text>
                  <View style={styles.timeSlotGrid}>
                    {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeSlotBtn,
                          selectedTimeSlots.includes(time) && styles.timeSlotBtnSelected
                        ]}
                        onPress={() => {
                          setSelectedTimeSlots(prev => 
                            prev.includes(time) 
                              ? prev.filter(t => t !== time)
                              : [...prev, time].sort()
                          );
                        }}
                      >
                        <Text style={[
                          styles.timeSlotBtnText,
                          selectedTimeSlots.includes(time) && styles.timeSlotBtnTextSelected
                        ]}>
                          {formatTime(time)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {selectedTimeSlots.length > 0 && (
                    <View style={styles.selectedSummary}>
                      <Text style={styles.selectedSummaryTitle}>Selected: {selectedTimeSlots.length} hour{selectedTimeSlots.length !== 1 ? 's' : ''}</Text>
                      <Text style={styles.selectedSummaryText}>
                        {selectedTimeSlots.map(time => formatTime(time)).join(', ')}
                      </Text>
                    </View>
                  )}
                </>
              )}
              
              <View style={styles.timeModalActions}>
                <TouchableOpacity 
                  style={styles.timeModalCancelBtn}
                  onPress={() => setShowTimeModal(false)}
                >
                  <Text style={styles.timeModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.timeModalSaveBtn,
                    (availabilityMode === 'custom' && selectedTimeSlots.length === 0) && styles.timeModalSaveBtnDisabled
                  ]}
                  disabled={availabilityMode === 'custom' && selectedTimeSlots.length === 0}
                  onPress={async () => {
                    try {
                      const allTimes = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
                      let unavailableTimes;
                      let notes;
                      
                      if (availabilityMode === 'range') {
                        // Range mode: times outside the range are unavailable
                        const fromHour = parseInt(availableFromTime.split(':')[0]);
                        const toHour = parseInt(availableToTime.split(':')[0]);
                        
                        unavailableTimes = allTimes.filter(time => {
                          const hour = parseInt(time.split(':')[0]);
                          return hour < fromHour || hour >= toHour;
                        });
                        
                        notes = `Available ${formatTime(availableFromTime)} - ${formatTime(availableToTime)}`;
                      } else {
                        // Custom mode: times not selected are unavailable
                        unavailableTimes = allTimes.filter(time => !selectedTimeSlots.includes(time));
                        
                        if (selectedTimeSlots.length === 1) {
                          notes = `Available at ${formatTime(selectedTimeSlots[0])}`;
                        } else {
                          const sortedSlots = [...selectedTimeSlots].sort();
                          notes = `Available: ${sortedSlots.map(t => formatTime(t)).join(', ')}`;
                        }
                      }
                      
                      await driverScheduleService.setAvailability(
                        user.id, 
                        selectedDate.dateStr, 
                        true, 
                        unavailableTimes, 
                        notes
                      );
                      
                      setShowTimeModal(false);
                      setShowModal(false);
                      onRefresh();
                      
                      // Reset states
                      setSelectedTimeSlots([]);
                      setAvailabilityMode('range');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to set availability');
                    }
                  }}
                >
                  <Text style={styles.timeModalSaveText}>
                    {availabilityMode === 'custom' && selectedTimeSlots.length === 0 
                      ? 'Select Hours First' 
                      : 'Set Available'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
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
  dayWithBooking: {
    backgroundColor: MAROON,
    borderRadius: 12,
    elevation: 2,
    shadowColor: MAROON,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  dayAvailable: {
    backgroundColor: '#4CAF50',
    borderRadius: 12
  },
  dayUnavailable: {
    backgroundColor: '#f44336',
    borderRadius: 12
  },
  dayPartial: {
    backgroundColor: '#FF9800',
    borderRadius: 12
  },
  dayUnset: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed'
  },
  dayPast: {
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    opacity: 0.5
  },
  dayPastWithBooking: {
    backgroundColor: '#8d6e63',
    borderRadius: 12,
    opacity: 0.8
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
  dayTextContrast: {
    color: '#fff',
    fontWeight: '700'
  },
  dayTextAvailable: {
    color: '#fff',
    fontWeight: '600'
  },
  dayTextPartial: {
    color: '#fff',
    fontWeight: '600'
  },
  dayTextPast: {
    color: '#999',
    fontWeight: '400'
  },
  dayTextPastWithBooking: {
    color: '#fff',
    fontWeight: '600'
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
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  unavailableBtn: {
    backgroundColor: '#ffeaea',
    borderColor: '#ffcdd2'
  },
  availableBtn: {
    backgroundColor: '#e8f5e8',
    borderColor: '#c8e6c9'
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: MAROON,
    marginLeft: 6
  },
  noBookingsContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  noBookingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12
  },
  noBookingsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 4
  },
  partialIndicator: {
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
  partialText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9800'
  },
  availabilityStatus: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#f8f9fa'
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  statusTextContainer: {
    marginLeft: 8
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  timeRangeText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 2
  },
  unavailableTimes: {
    marginTop: 8
  },
  unavailableLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4
  },
  unavailableTimesList: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '500'
  },
  notesContainer: {
    marginTop: 8
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic'
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
  timeModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%'
  },
  timeSelectionContainer: {
    padding: 24
  },
  timeSelectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  timeInputContainer: {
    flex: 1,
    marginHorizontal: 8
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8
  },
  timeInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  timeInputText: {
    fontSize: 16,
    fontWeight: '600',
    color: MAROON,
    textAlign: 'center'
  },
  presetsContainer: {
    marginBottom: 24
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  presetBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center'
  },
  timeModalActions: {
    flexDirection: 'row',
    gap: 12
  },
  timeModalCancelBtn: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  timeModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666'
  },
  timeModalSaveBtn: {
    flex: 1,
    backgroundColor: MAROON,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  timeModalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  timeModalSaveBtnDisabled: {
    backgroundColor: '#ccc'
  },
  modeSelection: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent'
  },
  modeBtnActive: {
    backgroundColor: MAROON
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: MAROON,
    marginLeft: 6
  },
  modeBtnTextActive: {
    color: '#fff'
  },
  customModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
    textAlign: 'center'
  },
  timeSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  timeSlotBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 80
  },
  timeSlotBtnSelected: {
    backgroundColor: MAROON,
    borderColor: MAROON
  },
  timeSlotBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center'
  },
  timeSlotBtnTextSelected: {
    color: '#fff'
  },
  selectedSummary: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50'
  },
  selectedSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4
  },
  selectedSummaryText: {
    fontSize: 12,
    color: '#388e3c',
    lineHeight: 18
  },
  pastDateNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  pastDateNoticeText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20
  }
});
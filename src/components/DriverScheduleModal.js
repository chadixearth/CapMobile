import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { driverScheduleService } from '../services/driverScheduleService';
import TimePickerModal from './TimePickerModal';
import { TIME_SLOTS, formatTime, isTimeInPast, isDateInPast } from '../constants/timeConstants';

const MAROON = '#6B2E2B';

export default function DriverScheduleModal({ visible, onClose, user, navigation }) {
  const [calendar, setCalendar] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [availabilityMode, setAvailabilityMode] = useState('range');
  const [availableFromTime, setAvailableFromTime] = useState('08:00');
  const [availableToTime, setAvailableToTime] = useState('18:00');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      loadCalendar();
    }
  }, [visible, user?.id, currentDate]);

  const loadCalendar = async () => {
    if (!user?.id) return;
    
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
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
      console.error('Error loading calendar:', error);
      Alert.alert('Error', 'Network error loading schedule. Please check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

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
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasBooking = hasBookingOnDate(day);
    const availability = getAvailabilityForDate(day);
    
    if (isDateInPast(dateStr)) {
      return hasBooking ? 'pastWithBooking' : 'past';
    }
    
    if (hasBooking) return 'booked';
    if (availability) {
      if (!availability.is_available) return 'unavailable';
      if (availability.unavailable_times?.length > 0) return 'partial';
      return 'available';
    }
    return 'unset';
  };

  const handleDatePress = (day) => {
    if (!day) return;
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const bookings = getBookingsForDate(day);
    const availability = getAvailabilityForDate(day);
    const isPastDate = isDateInPast(dateStr);
    const dateStatus = getDateStatus(day);
    
    if (dateStatus === 'past') {
      return;
    }
    
    if (isPastDate && bookings.length === 0 && dateStatus !== 'pastWithBooking') {
      Alert.alert('Past Date', 'No bookings to view for this past date.');
      return;
    }
    
    setSelectedDate({ day, bookings, availability, dateStr, isPastDate });
    setShowDateModal(true);
  };

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.scheduleModalContainer}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleTitle}>My Schedule</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scheduleContent}
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
                      onPress={() => handleDatePress(day)}
                      disabled={!day || dateStatus === 'past'}
                      activeOpacity={dateStatus === 'past' ? 1 : 0.7}
                      style={[
                        styles.dayCell,
                        dateStatus === 'booked' && styles.dayWithBooking,
                        dateStatus === 'available' && styles.dayAvailable,
                        dateStatus === 'unavailable' && styles.dayUnavailable,
                        dateStatus === 'partial' && styles.dayPartial,
                        dateStatus === 'unset' && styles.dayUnset,
                        dateStatus === 'past' && styles.dayPast,
                        dateStatus === 'pastWithBooking' && styles.dayPastWithBooking,
                        isToday && styles.todayCell,
                        (dateStatus === 'past') && styles.disabledCell
                      ]}
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
          </ScrollView>
        </View>
      </View>

      {/* Date Details Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate && `${currentDate.toLocaleDateString('en-US', { month: 'long' })} ${selectedDate.day}`}
              </Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
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
                      const unavailable = selectedDate.availability.unavailable_times;
                      const available = TIME_SLOTS.filter(time => !unavailable.includes(time));
                      
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
                  <>
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, styles.availableBtn]}
                      onPress={() => {
                        setAvailabilityMode('range');
                        setSelectedTimeSlots([]);
                        setAvailableFromTime('08:00');
                        setAvailableToTime('18:00');
                        setShowTimeModal(true);
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                      <Text style={[styles.modalActionText, { color: '#4CAF50' }]}>Set Available Hours</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, styles.unavailableBtn]}
                      onPress={async () => {
                        try {
                          await driverScheduleService.setAvailability(
                            user.id, 
                            selectedDate.dateStr, 
                            false, 
                            [], 
                            'Marked unavailable from calendar'
                          );
                          setShowDateModal(false);
                          onRefresh();
                        } catch (error) {
                          Alert.alert('Error', 'Failed to update availability');
                        }
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#d32f2f" />
                      <Text style={[styles.modalActionText, { color: '#d32f2f' }]}>Mark Unavailable</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={styles.modalActionBtn}
                    onPress={() => {
                      setShowDateModal(false);
                      onClose();
                      navigation?.navigate('SetAvailability', { selectedDate: selectedDate.dateStr });
                    }}
                  >
                    <Ionicons name="calendar-outline" size={16} color={MAROON} />
                    <Text style={styles.modalActionText}>Edit Availability</Text>
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
                        setShowDateModal(false);
                        onClose();
                        navigation?.navigate('Bookings');
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
                      <TouchableOpacity 
                        style={styles.timeInput}
                        onPress={() => setShowFromPicker(true)}
                      >
                        <Text style={styles.timeInputText}>{formatTime(availableFromTime)}</Text>
                        <Ionicons name="chevron-down" size={16} color={MAROON} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>To:</Text>
                      <TouchableOpacity 
                        style={styles.timeInput}
                        onPress={() => setShowToPicker(true)}
                      >
                        <Text style={styles.timeInputText}>{formatTime(availableToTime)}</Text>
                        <Ionicons name="chevron-down" size={16} color={MAROON} />
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
                    {TIME_SLOTS.map((time) => (
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
                      if (availabilityMode === 'range') {
                        if (isTimeInPast(selectedDate.dateStr, availableFromTime)) {
                          Alert.alert('Invalid Time', 'Start time is in the past.');
                          return;
                        }
                      } else {
                        const validSlots = selectedTimeSlots.filter(time => !isTimeInPast(selectedDate.dateStr, time));
                        if (validSlots.length === 0) {
                          Alert.alert('Invalid Time', 'All selected hours are in the past.');
                          return;
                        }
                        if (validSlots.length !== selectedTimeSlots.length) {
                          setSelectedTimeSlots(validSlots);
                          Alert.alert('Notice', `${selectedTimeSlots.length - validSlots.length} past hour(s) removed.`);
                          return;
                        }
                      }

                      let unavailableTimes;
                      let notes;
                      
                      if (availabilityMode === 'range') {
                        const fromHour = parseInt(availableFromTime.split(':')[0]);
                        const toHour = parseInt(availableToTime.split(':')[0]);
                        
                        unavailableTimes = TIME_SLOTS.filter(time => {
                          const hour = parseInt(time.split(':')[0]);
                          return hour < fromHour || hour >= toHour;
                        });
                        
                        notes = `Available ${formatTime(availableFromTime)} - ${formatTime(availableToTime)}`;
                      } else {
                        unavailableTimes = TIME_SLOTS.filter(time => !selectedTimeSlots.includes(time));
                        
                        if (selectedTimeSlots.length === 1) {
                          notes = `Available at ${formatTime(selectedTimeSlots[0])}`;
                        } else {
                          const sortedSlots = [...selectedTimeSlots].sort();
                          notes = `Available: ${sortedSlots.map(t => formatTime(t)).join(', ')}`;
                        }
                      }
                      
                      const result = await driverScheduleService.setAvailability(
                        user.id, 
                        selectedDate.dateStr, 
                        true, 
                        unavailableTimes, 
                        notes
                      );
                      
                      if (result.success) {
                        setShowTimeModal(false);
                        setShowDateModal(false);
                        onRefresh();
                        setSelectedTimeSlots([]);
                        setAvailabilityMode('range');
                      } else {
                        const errorMsg = result.errorType === 'NETWORK' 
                          ? 'Network error. Please check your connection.'
                          : result.error || 'Failed to set availability';
                        Alert.alert('Error', errorMsg);
                      }
                    } catch (error) {
                      Alert.alert('Error', 'An unexpected error occurred.');
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

      <TimePickerModal
        visible={showFromPicker}
        onClose={() => setShowFromPicker(false)}
        onSelect={(time) => {
          setAvailableFromTime(time);
          const fromHour = parseInt(time.split(':')[0]);
          const toHour = parseInt(availableToTime.split(':')[0]);
          if (toHour <= fromHour) {
            const nextSlot = TIME_SLOTS.find(slot => parseInt(slot.split(':')[0]) > fromHour);
            setAvailableToTime(nextSlot || TIME_SLOTS[TIME_SLOTS.length - 1]);
          }
          setShowFromPicker(false);
        }}
        selectedTime={availableFromTime}
        title="Select Start Time"
        timeOptions={TIME_SLOTS}
      />

      <TimePickerModal
        visible={showToPicker}
        onClose={() => setShowToPicker(false)}
        onSelect={(time) => {
          setAvailableToTime(time);
          setShowToPicker(false);
        }}
        selectedTime={availableToTime}
        title="Select End Time"
        timeOptions={TIME_SLOTS}
        minTime={availableFromTime}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleModalContainer: {
    width: '90%',
    height: '80%',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7E6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  scheduleTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
  },
  scheduleContent: {
    paddingTop:8,
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE7E6',
  },
  monthTitleContainer: {
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
    marginBottom: 4,
  },
  monthSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EDE7E6',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dayWithBooking: {
    backgroundColor: MAROON,
  },
  dayAvailable: {
    backgroundColor: '#4CAF50',
  },
  dayUnavailable: {
    backgroundColor: '#f44336',
  },
  dayPartial: {
    backgroundColor: '#FF9800',
  },
  dayUnset: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  dayPast: {
    backgroundColor: '#e0e0e0',
    opacity: 0.5,
  },
  dayPastWithBooking: {
    backgroundColor: '#8d6e63',
    opacity: 0.8,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  disabledCell: {
    opacity: 0.3,
  },
  dayTextContrast: {
    color: '#fff',
  },
  dayTextAvailable: {
    color: '#fff',
  },
  dayTextPartial: {
    color: '#fff',
  },
  dayTextPast: {
    color: '#999',
  },
  dayTextPastWithBooking: {
    color: '#fff',
  },
  todayText: {
    fontWeight: '800',
  },
  bookingIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingCount: {
    fontSize: 10,
    fontWeight: '800',
    color: MAROON,
  },
  partialIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partialText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF9800',
  },
  legendContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE7E6',
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItems: {
    flex: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  // Date modal styles
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  availabilityStatus: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  timeRangeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unavailableTimes: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  unavailableLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  unavailableTimesList: {
    fontSize: 12,
    color: '#f44336',
  },
  notesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#333',
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MAROON,
    gap: 6,
  },
  availableBtn: {
    borderColor: '#4CAF50',
  },
  unavailableBtn: {
    borderColor: '#d32f2f',
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: MAROON,
  },
  pastDateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  pastDateNoticeText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  modalBookings: {
    maxHeight: 300,
  },
  modalBookingCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalBookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: MAROON,
  },
  modalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e9ecef',
  },
  confirmedBadge: {
    backgroundColor: '#d4edda',
  },
  cancelledBadge: {
    backgroundColor: '#f8d7da',
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  confirmedText: {
    color: '#155724',
  },
  cancelledText: {
    color: '#721c24',
  },
  modalPackageName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  customerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  modalCustomerName: {
    fontSize: 14,
    color: '#666',
  },
  modalViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MAROON,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  modalViewText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  noBookingsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noBookingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  noBookingsSubtext: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 4,
    textAlign: 'center',
  },
  // Time modal styles
  timeModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  timeSelectionContainer: {
    flex: 1,
  },
  timeSelectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modeSelection: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: MAROON,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: MAROON,
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeInputText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  presetsContainer: {
    marginBottom: 20,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: MAROON,
  },
  customModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  timeSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeSlotBtn: {
    width: '30%',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeSlotBtnSelected: {
    backgroundColor: MAROON,
    borderColor: MAROON,
  },
  timeSlotBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  timeSlotBtnTextSelected: {
    color: '#fff',
  },
  selectedSummary: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  selectedSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  selectedSummaryText: {
    fontSize: 12,
    color: '#666',
  },
  timeModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  timeModalCancelBtn: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  timeModalSaveBtn: {
    flex: 1,
    backgroundColor: MAROON,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeModalSaveBtnDisabled: {
    backgroundColor: '#ccc',
  },
  timeModalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
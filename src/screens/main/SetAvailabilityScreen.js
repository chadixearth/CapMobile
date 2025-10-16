import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { driverScheduleService } from '../../services/driverScheduleService';
import TARTRACKHeader from '../../components/TARTRACKHeader';

const MAROON = '#6B2E2B';

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function SetAvailabilityScreen({ navigation, route }) {
  // Hide the default stack header (avoid double headers)
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { user } = useAuth();
  const passedDate = route?.params?.selectedDate;
  const [selectedDate, setSelectedDate] = useState(passedDate || new Date().toISOString().split('T')[0]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityMode, setAvailabilityMode] = useState('range');
  const [availableFromTime, setAvailableFromTime] = useState('08:00');
  const [availableToTime, setAvailableToTime] = useState('18:00');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFromTimePicker, setShowFromTimePicker] = useState(false);
  const [showToTimePicker, setShowToTimePicker] = useState(false);

  // Load existing availability when date changes
  React.useEffect(() => {
    const loadExistingAvailability = async () => {
      if (!user?.id || !selectedDate) return;
      
      // Check if selected date is in the past
      const selectedDateObj = new Date(selectedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDateObj < today) {
        Alert.alert(
          'Invalid Date', 
          'Cannot set availability for past dates. Redirecting to today.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      setLoading(true);
      try {
        const result = await driverScheduleService.getDriverSchedule(user.id, selectedDate, selectedDate);
        if (result.success && result.data?.length > 0) {
          const schedule = result.data[0];
          setIsAvailable(schedule.is_available);
          
          if (schedule.is_available && schedule.unavailable_times?.length > 0) {
            // Determine if it's range or custom mode based on pattern
            const allTimes = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
            const availableTimes = allTimes.filter(time => !schedule.unavailable_times.includes(time));
            
            if (availableTimes.length > 0) {
              // Check if it's a continuous range
              const isRange = availableTimes.every((time, index) => {
                if (index === 0) return true;
                const prevHour = parseInt(availableTimes[index - 1].split(':')[0]);
                const currHour = parseInt(time.split(':')[0]);
                return currHour === prevHour + 1;
              });
              
              if (isRange) {
                setAvailabilityMode('range');
                setAvailableFromTime(availableTimes[0]);
                const lastHour = parseInt(availableTimes[availableTimes.length - 1].split(':')[0]) + 1;
                setAvailableToTime(`${lastHour.toString().padStart(2, '0')}:00`);
              } else {
                setAvailabilityMode('custom');
                setSelectedTimeSlots(availableTimes);
              }
            }
          }
        } else {
          // Reset to defaults for new date
          setIsAvailable(true);
          setAvailabilityMode('range');
          setSelectedTimeSlots([]);
        }
      } catch (error) {
        console.log('Error loading existing availability:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExistingAvailability();
  }, [selectedDate, user?.id]);

  const toggleTimeSlot = (time) => {
    setSelectedTimeSlots(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time].sort()
    );
  };

  const timeOptions = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  const handleFromTimeSelect = (time) => {
    setAvailableFromTime(time);
    setShowFromTimePicker(false);
    // Auto-adjust 'to' time if it's not later than 'from' time
    const fromHour = parseInt(time.split(':')[0]);
    const toHour = parseInt(availableToTime.split(':')[0]);
    if (toHour <= fromHour) {
      const newToHour = Math.min(fromHour + 8, 20); // Default 8-hour shift, max 20:00
      setAvailableToTime(`${newToHour.toString().padStart(2, '0')}:00`);
    }
  };

  const handleToTimeSelect = (time) => {
    setAvailableToTime(time);
    setShowToTimePicker(false);
  };

  const getValidToTimes = () => {
    const fromHour = parseInt(availableFromTime.split(':')[0]);
    return timeOptions.filter(time => {
      const hour = parseInt(time.split(':')[0]);
      return hour > fromHour;
    });
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      // Additional validation for today's date with current time
      const selectedDateObj = new Date(selectedDate);
      const today = new Date();
      const isToday = selectedDateObj.toDateString() === today.toDateString();
      
      if (isToday && isAvailable) {
        const currentHour = today.getHours();
        
        if (availabilityMode === 'range') {
          const fromHour = parseInt(availableFromTime.split(':')[0]);
          if (fromHour <= currentHour) {
            Alert.alert(
              'Invalid Time', 
              `Cannot set availability for past hours. Current time is ${today.getHours()}:${today.getMinutes().toString().padStart(2, '0')}`
            );
            setSaving(false);
            return;
          }
        } else {
          const validSlots = selectedTimeSlots.filter(time => {
            const slotHour = parseInt(time.split(':')[0]);
            return slotHour > currentHour;
          });
          
          if (validSlots.length === 0) {
            Alert.alert(
              'Invalid Time', 
              'All selected hours are in the past. Please select future hours.'
            );
            setSaving(false);
            return;
          }
          
          if (validSlots.length !== selectedTimeSlots.length) {
            Alert.alert(
              'Some Hours Skipped', 
              `${selectedTimeSlots.length - validSlots.length} past hour(s) were automatically removed.`
            );
            setSelectedTimeSlots(validSlots);
          }
        }
      }
      
      let unavailableTimes = [];
      let notes = '';
      
      if (!isAvailable) {
        // If not available, mark all times as unavailable
        unavailableTimes = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
        notes = 'Not available';
      } else {
        // Available - calculate based on mode
        const allTimes = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
        
        if (availabilityMode === 'range') {
          const fromHour = parseInt(availableFromTime.split(':')[0]);
          const toHour = parseInt(availableToTime.split(':')[0]);
          
          unavailableTimes = allTimes.filter(time => {
            const hour = parseInt(time.split(':')[0]);
            return hour < fromHour || hour >= toHour;
          });
          
          notes = `Available ${formatTime(availableFromTime)} - ${formatTime(availableToTime)}`;
        } else {
          unavailableTimes = allTimes.filter(time => !selectedTimeSlots.includes(time));
          
          if (selectedTimeSlots.length === 1) {
            notes = `Available at ${formatTime(selectedTimeSlots[0])}`;
          } else {
            const sortedSlots = [...selectedTimeSlots].sort();
            notes = `Available: ${sortedSlots.map(t => formatTime(t)).join(', ')}`;
          }
        }
      }
      
      const result = await driverScheduleService.setAvailability(
        user.id,
        selectedDate,
        isAvailable,
        unavailableTimes,
        notes
      );

      if (result.success) {
        Alert.alert('Success', 'Availability updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to update availability');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error updating availability');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <View style={styles.container}>
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <ScrollView style={styles.content}>
        {/* Date Info */}
        <View style={styles.selectedDateInfo}>
          <Text style={styles.sectionTitle}>
            {passedDate ? 'Setting availability for:' : 'Today\'s Availability'}
          </Text>
          <View style={styles.dateInfoCard}>
            <Ionicons name="calendar" size={20} color={MAROON} />
            <Text style={styles.dateInfoText}>
              {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>
        </View>

        {/* Availability Toggle */}
        <View style={styles.availabilitySection}>
          <Text style={styles.sectionTitle}>Available on this day</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {isAvailable ? 'Available for bookings' : 'Not available'}
            </Text>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: '#ccc', true: MAROON }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Dynamic Availability Options */}
        {isAvailable && (
          <View style={styles.timeSlotsSection}>
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
                <Text style={styles.sectionTitle}>Available Hours</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeInputContainer}>
                    <Text style={styles.timeLabel}>From:</Text>
                    <TouchableOpacity 
                      style={styles.timeInput}
                      onPress={() => setShowFromTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeInputText}>{formatTime(availableFromTime)}</Text>
                      <Ionicons name="chevron-down" size={16} color={MAROON} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.timeInputContainer}>
                    <Text style={styles.timeLabel}>To:</Text>
                    <TouchableOpacity 
                      style={styles.timeInput}
                      onPress={() => setShowToTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeInputText}>{formatTime(availableToTime)}</Text>
                      <Ionicons name="chevron-down" size={16} color={MAROON} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Quick Presets */}
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
                <Text style={styles.sectionTitle}>Select Available Hours</Text>
                <Text style={styles.sectionSubtitle}>
                  Tap the hours when you're available
                </Text>
                
                <View style={styles.timeGrid}>
                  {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeSlot,
                        selectedTimeSlots.includes(time) && styles.selectedTimeSlot
                      ]}
                      onPress={() => toggleTimeSlot(time)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        selectedTimeSlots.includes(time) && styles.selectedTimeSlotText
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
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn, 
            (saving || (isAvailable && availabilityMode === 'custom' && selectedTimeSlots.length === 0)) && styles.saveBtnDisabled
          ]}
          onPress={saveAvailability}
          disabled={saving || (isAvailable && availabilityMode === 'custom' && selectedTimeSlots.length === 0)}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 
             (isAvailable && availabilityMode === 'custom' && selectedTimeSlots.length === 0) ? 'Select Hours First' :
             'Save Availability'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* From Time Picker Modal */}
      <Modal
        visible={showFromTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFromTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Select Start Time</Text>
              <TouchableOpacity onPress={() => setShowFromTimePicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timePickerList}>
              {timeOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timePickerItem,
                    availableFromTime === time && styles.timePickerItemSelected
                  ]}
                  onPress={() => handleFromTimeSelect(time)}
                >
                  <Text style={[
                    styles.timePickerItemText,
                    availableFromTime === time && styles.timePickerItemTextSelected
                  ]}>
                    {formatTime(time)}
                  </Text>
                  {availableFromTime === time && (
                    <Ionicons name="checkmark" size={20} color={MAROON} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* To Time Picker Modal */}
      <Modal
        visible={showToTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowToTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Select End Time</Text>
              <TouchableOpacity onPress={() => setShowToTimePicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.timePickerList}>
              {getValidToTimes().map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timePickerItem,
                    availableToTime === time && styles.timePickerItemSelected
                  ]}
                  onPress={() => handleToTimeSelect(time)}
                >
                  <Text style={[
                    styles.timePickerItemText,
                    availableToTime === time && styles.timePickerItemTextSelected
                  ]}>
                    {formatTime(time)}
                  </Text>
                  {availableToTime === time && (
                    <Ionicons name="checkmark" size={20} color={MAROON} />
                  )}
                </TouchableOpacity>
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

  content: {
    flex: 1,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 20
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  dateScroll: {
    marginBottom: 20
  },
  dateCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#eee'
  },
  selectedDateCard: {
    backgroundColor: MAROON,
    borderColor: MAROON
  },
  dateLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500'
  },
  selectedDateLabel: {
    color: '#fff'
  },
  availabilitySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  switchLabel: {
    fontSize: 16,
    color: '#333'
  },
  timeSlotsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  timeSlot: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  unavailableTimeSlot: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336'
  },
  timeSlotText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500'
  },
  unavailableTimeSlotText: {
    color: '#f44336'
  },
  saveBtn: {
    backgroundColor: MAROON,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40
  },
  saveBtnDisabled: {
    opacity: 0.6
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  selectedDateInfo: {
    marginBottom: 20
  },
  dateInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: MAROON
  },
  dateInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12
  },
  modeSelection: {
    flexDirection: 'row',
    marginBottom: 20,
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
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
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
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  timeInputText: {
    fontSize: 16,
    fontWeight: '600',
    color: MAROON,
    textAlign: 'center'
  },
  presetsContainer: {
    marginBottom: 20
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
  selectedTimeSlot: {
    backgroundColor: MAROON,
    borderColor: MAROON
  },
  selectedTimeSlotText: {
    color: '#fff'
  },
  selectedSummary: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  timePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%'
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  timePickerList: {
    maxHeight: 300
  },
  timePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5'
  },
  timePickerItemSelected: {
    backgroundColor: '#f8f9fa'
  },
  timePickerItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500'
  },
  timePickerItemTextSelected: {
    color: MAROON,
    fontWeight: '600'
  }
});
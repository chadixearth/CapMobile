import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { driverScheduleService } from '../../services/driverScheduleService';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import TimePickerModal from '../../components/TimePickerModal';
import { TIME_SLOTS, formatTime, isTimeInPast, isDateInPast, getValidTimeSlotsForDate } from '../../constants/timeConstants';

const MAROON = '#6B2E2B';

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
  const [hasNonContinuousSlots, setHasNonContinuousSlots] = useState(false);

  // Load existing availability when date changes
  React.useEffect(() => {
    const loadExistingAvailability = async () => {
      if (!user?.id || !selectedDate) return;
      
      // Check if selected date is in the past
      if (isDateInPast(selectedDate)) {
        Alert.alert(
          'Invalid Date', 
          'Cannot set availability for past dates.',
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
            const availableTimes = TIME_SLOTS.filter(time => !schedule.unavailable_times.includes(time));
            
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
  }, [selectedDate, user?.id, navigation]);

  const toggleTimeSlot = (time) => {
    const newSlots = selectedTimeSlots.includes(time) 
      ? selectedTimeSlots.filter(t => t !== time)
      : [...selectedTimeSlots, time].sort();
    
    setSelectedTimeSlots(newSlots);
    
    // Check for non-continuous slots
    if (newSlots.length > 1) {
      const isContinuous = newSlots.every((slot, index) => {
        if (index === 0) return true;
        const prevHour = parseInt(newSlots[index - 1].split(':')[0]);
        const currHour = parseInt(slot.split(':')[0]);
        return currHour === prevHour + 1;
      });
      setHasNonContinuousSlots(!isContinuous);
    } else {
      setHasNonContinuousSlots(false);
    }
  };

  const handleFromTimeSelect = (time) => {
    setAvailableFromTime(time);
    setShowFromTimePicker(false);
    
    // Auto-adjust 'to' time if it's not later than 'from' time
    const fromHour = parseInt(time.split(':')[0]);
    const toHour = parseInt(availableToTime.split(':')[0]);
    
    if (toHour <= fromHour) {
      // Find next available slot, default to 8 hours or end of day
      const maxHour = Math.min(fromHour + 8, 20);
      const nextSlot = TIME_SLOTS.find(slot => parseInt(slot.split(':')[0]) >= maxHour);
      setAvailableToTime(nextSlot || '20:00');
    }
  };

  const handleToTimeSelect = (time) => {
    setAvailableToTime(time);
    setShowToTimePicker(false);
  };

  const saveAvailability = async () => {
    // Show confirmation for non-continuous slots
    if (hasNonContinuousSlots && availabilityMode === 'custom') {
      Alert.alert(
        'Non-Continuous Hours',
        'You have selected non-continuous hours. This means you will have gaps in your availability. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {} },
          { text: 'Continue', onPress: () => performSave() }
        ]
      );
      return;
    }
    
    performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      // Validate times are not in the past
      if (isAvailable) {
        if (availabilityMode === 'range') {
          if (isTimeInPast(selectedDate, availableFromTime)) {
            Alert.alert(
              'Invalid Time', 
              'Start time is in the past. Please select a future time.'
            );
            setSaving(false);
            return;
          }
        } else {
          const validSlots = selectedTimeSlots.filter(time => !isTimeInPast(selectedDate, time));
          
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
              'Some Hours Removed', 
              `${selectedTimeSlots.length - validSlots.length} past hour(s) were removed.`,
              [{ text: 'OK', onPress: () => setSelectedTimeSlots(validSlots) }]
            );
            setSaving(false);
            return;
          }
        }
      }
      
      let unavailableTimes = [];
      let notes = '';
      
      if (!isAvailable) {
        unavailableTimes = TIME_SLOTS;
        notes = 'Not available';
      } else {
        
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
        const errorMsg = result.errorType === 'NETWORK' 
          ? 'Network error. Please check your connection and try again.'
          : result.error || 'Failed to update availability';
        Alert.alert('Error', errorMsg);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const validTimeSlots = getValidTimeSlotsForDate(selectedDate);

  if (loading) {
    return (
      <View style={styles.container}>
        <TARTRACKHeader
          onMessagePress={() => navigation.navigate('Chat')}
          onNotificationPress={() => navigation.navigate('Notification')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MAROON} />
          <Text style={styles.loadingText}>Loading availability...</Text>
        </View>
      </View>
    );
  }

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
                  {validTimeSlots.map((time) => (
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
                    {hasNonContinuousSlots && (
                      <View style={styles.warningBanner}>
                        <Ionicons name="warning-outline" size={16} color="#f57c00" />
                        <Text style={styles.warningText}>Non-continuous hours selected</Text>
                      </View>
                    )}
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

      <TimePickerModal
        visible={showFromTimePicker}
        onClose={() => setShowFromTimePicker(false)}
        onSelect={handleFromTimeSelect}
        selectedTime={availableFromTime}
        title="Select Start Time"
        timeOptions={validTimeSlots}
      />

      <TimePickerModal
        visible={showToTimePicker}
        onClose={() => setShowToTimePicker(false)}
        onSelect={handleToTimeSelect}
        selectedTime={availableToTime}
        title="Select End Time"
        timeOptions={TIME_SLOTS}
        minTime={availableFromTime}
      />
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ffd54f'
  },
  warningText: {
    fontSize: 12,
    color: '#f57c00',
    marginLeft: 6,
    fontWeight: '600'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  }
});
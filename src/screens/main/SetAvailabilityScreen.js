import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { driverScheduleService } from '../../services/driverScheduleService';

const MAROON = '#6B2E2B';

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function SetAvailabilityScreen({ navigation }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [unavailableTimes, setUnavailableTimes] = useState([]);
  const [saving, setSaving] = useState(false);

  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : 
               date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return days;
  };

  const toggleTimeSlot = (time) => {
    setUnavailableTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const result = await driverScheduleService.setAvailability(
        user.id,
        selectedDate,
        isAvailable,
        unavailableTimes
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Availability</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Date Selection */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {getNext7Days().map((day) => (
            <TouchableOpacity
              key={day.date}
              style={[
                styles.dateCard,
                selectedDate === day.date && styles.selectedDateCard
              ]}
              onPress={() => setSelectedDate(day.date)}
            >
              <Text style={[
                styles.dateLabel,
                selectedDate === day.date && styles.selectedDateLabel
              ]}>
                {day.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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

        {/* Time Slots */}
        {isAvailable && (
          <View style={styles.timeSlotsSection}>
            <Text style={styles.sectionTitle}>Unavailable Time Slots</Text>
            <Text style={styles.sectionSubtitle}>
              Select times when you're NOT available
            </Text>
            
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeSlot,
                    unavailableTimes.includes(time) && styles.unavailableTimeSlot
                  ]}
                  onPress={() => toggleTimeSlot(time)}
                >
                  <Text style={[
                    styles.timeSlotText,
                    unavailableTimes.includes(time) && styles.unavailableTimeSlotText
                  ]}>
                    {formatTime(time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={saveAvailability}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving...' : 'Save Availability'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8'
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
  }
});
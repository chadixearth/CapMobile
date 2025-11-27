import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '../constants/timeConstants';

const MAROON = '#6B2E2B';

export default function TimePickerModal({ 
  visible, 
  onClose, 
  onSelect, 
  selectedTime, 
  title = 'Select Time',
  timeOptions = [],
  minTime = null
}) {
  const filteredOptions = minTime 
    ? timeOptions.filter(time => {
        const timeHour = parseInt(time.split(':')[0]);
        const minHour = parseInt(minTime.split(':')[0]);
        return timeHour > minHour;
      })
    : timeOptions;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.timePickerModal}>
          <View style={styles.timePickerHeader}>
            <Text style={styles.timePickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.timePickerList}>
            {filteredOptions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No available times</Text>
              </View>
            ) : (
              filteredOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timePickerItem,
                    selectedTime === time && styles.timePickerItemSelected
                  ]}
                  onPress={() => onSelect(time)}
                >
                  <Text style={[
                    styles.timePickerItemText,
                    selectedTime === time && styles.timePickerItemTextSelected
                  ]}>
                    {formatTime(time)}
                  </Text>
                  {selectedTime === time && (
                    <Ionicons name="checkmark" size={20} color={MAROON} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
  emptyState: {
    padding: 40,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: '#999'
  }
});

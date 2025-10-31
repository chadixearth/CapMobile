import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { _dateHelpers } from '../services/Earnings/EarningsService';

const { width } = Dimensions.get('window');

const getMonthName = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'long' });
};

export default function CalendarModal({
  visible,
  onClose,
  onDateSelect,
  mode = 'day', // 'day', 'week', 'month', 'year'
  selectedDate,
  customDateRange,
}) {
  const [markedDates, setMarkedDates] = useState({});
  const [tempSelection, setTempSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (customDateRange && !isSelecting) {
        // Show existing selection
        if (mode === 'month') {
          updateRangeMarkedDates(customDateRange.from, customDateRange.to);
        } else {
          updateMarkedDates(customDateRange.from);
        }
      } else if (selectedDate && !isSelecting) {
        if (mode !== 'month') {
          updateMarkedDates(selectedDate);
        }
      }
    }
  }, [selectedDate, mode, visible, customDateRange, isSelecting, updateMarkedDates, updateRangeMarkedDates]);

  const updateMarkedDates = useCallback((date) => {
    const marked = {};
    
    if (mode === 'day') {
      marked[date] = {
        selected: true,
        selectedColor: '#6B2E2B',
      };
    } else if (mode === 'week') {
      const selectedDate = new Date(date);
      const startOfWeek = _dateHelpers.startOfWeekMonday(selectedDate);
      
      for (let i = 0; i < 7; i++) {
        const currentDate = _dateHelpers.addDays(startOfWeek, i);
        const dateString = _dateHelpers.toLocalYMD(currentDate);
        
        marked[dateString] = {
          selected: true,
          selectedColor: i === 0 || i === 6 ? '#6B2E2B' : '#8B4A47', // Monday (i=0) and Sunday (i=6) darker
          selectedTextColor: '#fff',
        };
      }
    } else if (mode === 'month') {
      const selectedDate = new Date(date);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        marked[dateString] = {
          selected: true,
          selectedColor: day === 1 || day === daysInMonth ? '#6B2E2B' : '#8B4A47',
          selectedTextColor: '#fff',
        };
      }
    } else if (mode === 'year') {
      const selectedDate = new Date(date);
      const year = selectedDate.getFullYear();
      
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          marked[dateString] = {
            selected: true,
            selectedColor: (month === 0 && day === 1) || (month === 11 && day === daysInMonth) ? '#6B2E2B' : '#8B4A47',
            selectedTextColor: '#fff',
          };
        }
      }
    }
    
    setMarkedDates(marked);
  }, [mode]);



  const handleDayPress = (day) => {
    const selectedDateString = day.dateString;
    
    if (mode === 'day') {
      setTempSelection({ from: selectedDateString, to: selectedDateString });
      updateMarkedDates(selectedDateString);
    } else if (mode === 'week') {
      const selectedDate = new Date(selectedDateString + 'T00:00:00');
      const startOfWeek = _dateHelpers.startOfWeekMonday(selectedDate);
      const endOfWeek = _dateHelpers.addDays(startOfWeek, 6); // Sunday (6 days after Monday)
      
      const weekStart = _dateHelpers.toLocalYMD(startOfWeek);
      const weekEnd = _dateHelpers.toLocalYMD(endOfWeek);
      
      console.log('[WEEK] Selected date:', selectedDateString);
      console.log('[WEEK] Start of week (Monday):', weekStart);
      console.log('[WEEK] End of week (Sunday):', weekEnd);
      console.log('[WEEK] Week range:', weekStart, 'to', weekEnd);
      
      setTempSelection({ from: weekStart, to: weekEnd });
      updateMarkedDates(selectedDateString);
    } else if (mode === 'month') {
      const selectedDate = new Date(selectedDateString);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0); // Last day of the month
      
      const monthStart = _dateHelpers.toLocalYMD(startOfMonth);
      const monthEnd = _dateHelpers.toLocalYMD(endOfMonth);
      
      console.log('[MONTH] Selected date:', selectedDateString);
      console.log('[MONTH] Start of month:', monthStart);
      console.log('[MONTH] End of month:', monthEnd);
      console.log('[MONTH] Month range:', monthStart, 'to', monthEnd);
      
      setTempSelection({ from: monthStart, to: monthEnd });
      updateMarkedDates(selectedDateString);
    } else if (mode === 'year') {
      const selectedDate = new Date(selectedDateString + 'T00:00:00');
      const year = selectedDate.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);
      
      const yearStart = _dateHelpers.toLocalYMD(startOfYear);
      const yearEnd = _dateHelpers.toLocalYMD(endOfYear);
      
      setTempSelection({ from: yearStart, to: yearEnd });
      updateMarkedDates(selectedDateString);
    }
  };

  const updateRangeMarkedDates = useCallback((start, end) => {
    const marked = {};
    const startDate = new Date(start);
    const endDate = new Date(end);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      if (dateString === start) {
        marked[dateString] = {
          selected: true,
          selectedColor: '#6B2E2B',
          selectedTextColor: '#fff',
          startingDay: true
        };
      } else if (dateString === end) {
        marked[dateString] = {
          selected: true,
          selectedColor: '#6B2E2B',
          selectedTextColor: '#fff',
          endingDay: true
        };
      } else {
        marked[dateString] = {
          selected: true,
          selectedColor: '#8B4A47',
          selectedTextColor: '#fff'
        };
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    setMarkedDates(marked);
  }, []);

  const handleConfirm = () => {
    if (tempSelection) {
      onDateSelect(tempSelection.from, tempSelection.to);
    }
  };

  const handleSelectNew = () => {
    setIsSelecting(true);
    setTempSelection(null);
    setMarkedDates({});
  };

  const hasExistingSelection = customDateRange && !isSelecting;
  const canConfirm = tempSelection !== null;

  const title = useMemo(() => {
    switch (mode) {
      case 'day': return 'Select Date';
      case 'week': return 'Select Week';
      case 'month': return 'Select Month';
      case 'year': return 'Select Year';
      default: return 'Select Date';
    }
  }, [mode]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <Calendar
            onDayPress={handleDayPress}
            markedDates={markedDates}
            renderHeader={(date) => {
              const monthName = new Date(date).toLocaleString('en-US', { month: 'long' });
              const year = new Date(date).getFullYear();
              return (
                <Text style={styles.calendarHeader}>{monthName} {year}</Text>
              );
            }}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: '#6B2E2B',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#6B2E2B',
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              dotColor: '#6B2E2B',
              selectedDotColor: '#ffffff',
              arrowColor: '#6B2E2B',
              disabledArrowColor: '#d9e1e8',
              monthTextColor: '#2d4150',
              indicatorColor: '#6B2E2B',
              textDayFontWeight: '300',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '300',
              textDayFontSize: 16,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 13,
            }}
          />
          
          <View style={styles.modalFooter}>
            {hasExistingSelection ? (
              <View>
                <Text style={styles.currentSelectionText}>
                  Current: {getMonthName(customDateRange.from)} - {getMonthName(customDateRange.to)}
                </Text>
                <TouchableOpacity style={styles.selectNewButton} onPress={handleSelectNew}>
                  <Text style={styles.selectNewButtonText}>Select New {mode === 'day' ? 'Date' : mode === 'week' ? 'Week' : mode === 'month' ? 'Month' : 'Year'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.instructionText}>
                  {mode === 'day' && 'Tap a date to select it'}
                  {mode === 'week' && 'Tap any day to select the entire week'}
                  {mode === 'month' && 'Tap any day to select the entire month'}
                  {mode === 'year' && 'Tap any day to select the entire year'}
                </Text>
                
                {canConfirm && (
                  <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                    <Text style={styles.confirmButtonText}>Confirm Selection</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  dateRangeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateRangeText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#6B2E2B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentSelectionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  selectNewButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  selectNewButtonText: {
    color: '#6B2E2B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  calendarHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d4150',
    textAlign: 'center',
    paddingVertical: 10,
  },
});
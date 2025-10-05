import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import BackButton from '../../components/BackButton';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import { createCustomTourRequest, createSpecialEventRequest } from '../../services/specialpackage/customPackageRequest';
import { getCurrentUser } from '../../services/authService';

const MAROON = '#6B2E2B';

export default function CustomPackageRequestScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestType, setRequestType] = useState('custom_tour'); // 'custom_tour' or 'special_event'
  
  // Common fields
  const [contactNumber, setContactNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [numberOfPax, setNumberOfPax] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  
  // Custom tour fields
  const [destination, setDestination] = useState('');
  const [preferredDurationHours, setPreferredDurationHours] = useState('');
  const [preferredDate, setPreferredDate] = useState(null);
  
  // Special event fields
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState(null);
  const [eventTime, setEventTime] = useState(null);
  const [specialRequirements, setSpecialRequirements] = useState('');
  
  // Date/Time picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('preferred'); // 'preferred' or 'event'
  
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate Event', 'Graduation', 'Anniversary', 'Other'];

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setContactEmail(currentUser.email || '');
        setContactNumber(currentUser.phone || '');
      } else {
        Alert.alert('Error', 'Please log in to make a custom request');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      Alert.alert('Error', 'Please log in to make a custom request');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailableDay = (day) => {
    setAvailableDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const validateCustomTourForm = () => {
    if (!destination.trim()) {
      Alert.alert('Validation Error', 'Please enter a destination');
      return false;
    }
    if (!numberOfPax || parseInt(numberOfPax) < 1) {
      Alert.alert('Validation Error', 'Please enter a valid number of passengers');
      return false;
    }
    if (!contactNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your contact number');
      return false;
    }
    return true;
  };

  const validateSpecialEventForm = () => {
    if (!eventType.trim()) {
      Alert.alert('Validation Error', 'Please select an event type');
      return false;
    }
    if (!eventDate) {
      Alert.alert('Validation Error', 'Please select an event date');
      return false;
    }
    if (!numberOfPax || parseInt(numberOfPax) < 1) {
      Alert.alert('Validation Error', 'Please enter a valid number of passengers');
      return false;
    }
    if (!pickupLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter the event address');
      return false;
    }
    if (!contactNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your contact number');
      return false;
    }
    return true;
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === 'preferred') {
        setPreferredDate(selectedDate);
      } else {
        setEventDate(selectedDate);
      }
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setEventTime(selectedTime);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString();
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please log in again.');
      return;
    }

    if (requestType === 'custom_tour' && !validateCustomTourForm()) {
      return;
    }

    if (requestType === 'special_event' && !validateSpecialEventForm()) {
      return;
    }

    setLoading(true);

    try {
      let result;
      
      if (requestType === 'custom_tour') {
        const customTourData = {
          customer_id: user.id,
          pickup_location: pickupLocation.trim(),
          destination: destination.trim(),
          preferred_duration_hours: preferredDurationHours ? parseInt(preferredDurationHours) : null,
          number_of_pax: parseInt(numberOfPax),
          preferred_date: preferredDate ? (typeof preferredDate === 'string' ? preferredDate : preferredDate.toISOString().split('T')[0]) : null,
          special_requests: specialRequests.trim(),
          contact_number: contactNumber.trim(),
          contact_email: contactEmail.trim()
        };

        result = await createCustomTourRequest(customTourData);
      } else {
        const specialEventData = {
          customer_id: user.id,
          event_type: eventType.trim(),
          event_date: eventDate ? eventDate.toISOString().split('T')[0] : null,
          event_time: eventTime ? eventTime.toTimeString().split(' ')[0] : null,
          number_of_pax: parseInt(numberOfPax),
          pickup_location: pickupLocation.trim(), // This will be mapped to event_address in the service
          special_requirements: specialRequirements.trim(),
          contact_number: contactNumber.trim(),
          contact_email: contactEmail.trim()
        };

        result = await createSpecialEventRequest(specialEventData);
      }

      if (result.success) {
        Alert.alert(
          'Request Submitted!', 
          result.message || 'Your custom package request has been submitted successfully. We will contact you soon.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit your request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderCustomTourForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Custom Tour Package Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Destination *</Text>
        <TextInput
          style={styles.input}
          value={destination}
          onChangeText={setDestination}
          placeholder="Where would you like to go?"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Duration (hours)</Text>
        <TextInput
          style={styles.input}
          value={preferredDurationHours}
          onChangeText={setPreferredDurationHours}
          placeholder="How many hours? (optional)"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Preferred Date</Text>
        <TouchableOpacity
          style={[styles.input, styles.dateInput]}
          onPress={() => {
            setDatePickerMode('preferred');
            setShowDatePicker(true);
          }}
        >
          <Text style={[styles.dateText, !preferredDate && styles.placeholderText]}>
            {preferredDate ? formatDate(preferredDate) : 'Select date (optional)'}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={MAROON} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSpecialEventForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Special Event Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Type *</Text>
        <View style={styles.pickerContainer}>
          {EVENT_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.eventTypeChip,
                eventType === type && styles.eventTypeChipSelected
              ]}
              onPress={() => setEventType(type)}
            >
              <Text style={[
                styles.eventTypeChipText,
                eventType === type && styles.eventTypeChipTextSelected
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.rowContainer}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Event Date *</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateInput]}
            onPress={() => {
              setDatePickerMode('event');
              setShowDatePicker(true);
            }}
          >
            <Text style={[styles.dateText, !eventDate && styles.placeholderText]}>
              {eventDate ? formatDate(eventDate) : 'Select date'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={MAROON} />
          </TouchableOpacity>
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Event Time</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateInput]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={[styles.dateText, !eventTime && styles.placeholderText]}>
              {eventTime ? formatTime(eventTime) : 'Select time'}
            </Text>
            <Ionicons name="time-outline" size={20} color={MAROON} />
          </TouchableOpacity>
        </View>
      </View>



      <View style={styles.inputGroup}>
        <Text style={styles.label}>Special Requirements</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={specialRequirements}
          onChangeText={setSpecialRequirements}
          placeholder="Any special requirements for your event..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  const renderCommonFields = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Contact & General Information</Text>
      
      <View style={styles.rowContainer}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Number of Passengers *</Text>
          <TextInput
            style={styles.input}
            value={numberOfPax}
            onChangeText={setNumberOfPax}
            placeholder="1"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Contact Number *</Text>
          <TextInput
            style={styles.input}
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="09XX XXX XXXX"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          {requestType === 'special_event' ? 'Event Address *' : 'Pickup Location'}
        </Text>
        <TextInput
          style={styles.input}
          value={pickupLocation}
          onChangeText={setPickupLocation}
          placeholder={
            requestType === 'special_event' 
              ? "Where will the event take place?" 
              : "Where should we pick you up?"
          }
          placeholderTextColor="#999"
        />
      </View>

      {requestType === 'custom_tour' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Destination</Text>
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            placeholder="Additional destination info (optional)"
            placeholderTextColor="#999"
          />
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Contact Email</Text>
        <TextInput
          style={styles.input}
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="your@email.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          {requestType === 'custom_tour' ? 'Special Requests' : 'Additional Notes'}
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={requestType === 'custom_tour' ? specialRequests : specialRequests}
          onChangeText={setSpecialRequests}
          placeholder="Any additional information or special requests..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );

  if (loading && !user) {
    return <LoadingScreen message="Loading user information..." icon="person-outline" />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BackButton onPress={() => navigation.goBack()} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Custom Package Request</Text>
          <Text style={styles.subtitle}>Tell us about your ideal tour package or special event</Text>
        </View>

        {/* Request Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              requestType === 'custom_tour' && styles.typeButtonSelected
            ]}
            onPress={() => setRequestType('custom_tour')}
          >
            <Ionicons 
              name="map-outline" 
              size={24} 
              color={requestType === 'custom_tour' ? '#fff' : MAROON} 
            />
            <Text style={[
              styles.typeButtonText,
              requestType === 'custom_tour' && styles.typeButtonTextSelected
            ]}>
              Custom Tour
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              requestType === 'special_event' && styles.typeButtonSelected
            ]}
            onPress={() => setRequestType('special_event')}
          >
            <Ionicons 
              name="star-outline" 
              size={24} 
              color={requestType === 'special_event' ? '#fff' : MAROON} 
            />
            <Text style={[
              styles.typeButtonText,
              requestType === 'special_event' && styles.typeButtonTextSelected
            ]}>
              Special Event
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        {requestType === 'custom_tour' ? renderCustomTourForm() : renderSpecialEventForm()}
        {renderCommonFields()}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={loading ? 'Submitting...' : 'Submit Request'}
            onPress={handleSubmit}
            disabled={loading}
          />
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'preferred' ? (preferredDate || new Date()) : (eventDate || new Date())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={eventTime || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    marginTop: 24,
    marginLeft: 40
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginLeft: 35,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  typeButtonSelected: {
    backgroundColor: MAROON,
  },
  typeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: MAROON,
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventTypeChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  eventTypeChipSelected: {
    backgroundColor: MAROON,
    borderColor: MAROON,
  },
  eventTypeChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  eventTypeChipTextSelected: {
    color: '#fff',
  },
  submitContainer: {
    marginTop: 20,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createBooking } from '../../services/tourpackage/requestBooking';
import { fetchTourPackages } from '../../services/tourpackage/fetchingPackage';
import { TARTRACKHeader } from '../../components/TARTRACKHeader';
import { Button } from '../../components/Button';

const RequestBookingScreen = ({ route, navigation }) => {
  const { packageId, packageData } = route.params || {};
  
  // Form state
  const [formData, setFormData] = useState({
    package_id: packageId || '',
    customer_id: '', // Will be set from user context
    booking_date: new Date(),
    pickup_time: '09:00',
    number_of_pax: 1,
    total_amount: 0,
    special_requests: '',
    contact_number: '',
    pickup_address: '',
  });

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    loadPackages();
    if (packageData) {
      setSelectedPackage(packageData);
      setFormData(prev => ({
        ...prev,
        package_id: packageData.id,
        pickup_address: packageData.pickup_location || '',
        total_amount: packageData.price || 0,
      }));
    }
  }, [packageData]);

  const loadPackages = async () => {
    try {
      const response = await fetchTourPackages();
      if (response.success && response.data) {
        setPackages(response.data);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      Alert.alert('Error', 'Failed to load tour packages');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Recalculate total amount when package or number of pax changes
    if (field === 'package_id' || field === 'number_of_pax') {
      const selectedPackage = packages.find(p => p.id === (field === 'package_id' ? value : formData.package_id));
      if (selectedPackage) {
        const newTotal = selectedPackage.price * (field === 'number_of_pax' ? value : formData.number_of_pax);
        setFormData(prev => ({
          ...prev,
          total_amount: newTotal,
          pickup_address: selectedPackage.pickup_location || prev.pickup_address,
        }));
      }
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        booking_date: selectedDate,
      }));
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const timeString = selectedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setFormData(prev => ({
        ...prev,
        pickup_time: timeString,
      }));
    }
  };

  const validateForm = () => {
    const requiredFields = ['package_id', 'booking_date', 'number_of_pax', 'total_amount'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        Alert.alert('Validation Error', `Please fill in ${field.replace('_', ' ')}`);
        return false;
      }
    }

    if (formData.number_of_pax <= 0) {
      Alert.alert('Validation Error', 'Number of passengers must be greater than 0');
      return false;
    }

    const selectedPackageForValidation = packages.find(p => p.id === formData.package_id);
    if (selectedPackageForValidation && selectedPackageForValidation.max_pax && formData.number_of_pax > selectedPackageForValidation.max_pax) {
      Alert.alert('Validation Error', `Maximum passengers allowed: ${selectedPackageForValidation.max_pax}`);
      return false;
    }

    const bookingDate = new Date(formData.booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      Alert.alert('Validation Error', 'Booking date cannot be in the past');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Format the booking data
      const bookingData = {
        ...formData,
        booking_date: formData.booking_date.toISOString().split('T')[0],
        customer_id: 'user-id-here', // Replace with actual user ID from context
      };

      const response = await createBooking(bookingData);
      
      if (response.success) {
        Alert.alert(
          'Booking Successful',
          `Your booking has been created successfully!\nBooking Reference: ${response.booking_reference}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('TouristHome'),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.error || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TARTRACKHeader title="Request Booking" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Tour Package Details</Text>
          
          {/* Package Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Select Tour Package *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.package_id}
                onValueChange={(value) => handleInputChange('package_id', value)}
                style={styles.picker}
              >
                <Picker.Item label="Select a package" value="" />
                {packages.map((pkg) => (
                  <Picker.Item 
                    key={pkg.id} 
                    label={`${pkg.package_name} - ₱${pkg.price}`} 
                    value={pkg.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Booking Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Booking Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {formatDate(formData.booking_date)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pickup Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Time</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {formData.pickup_time}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Number of Passengers */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Number of Passengers *</Text>
            <TextInput
              style={styles.input}
              value={formData.number_of_pax.toString()}
              onChangeText={(value) => handleInputChange('number_of_pax', parseInt(value) || 0)}
              keyboardType="numeric"
              placeholder="Enter number of passengers"
            />
          </View>

          {/* Total Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Amount</Text>
            <Text style={styles.totalAmount}>₱{formData.total_amount.toFixed(2)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Contact Information</Text>

          {/* Contact Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_number}
              onChangeText={(value) => handleInputChange('contact_number', value)}
              placeholder="Enter your contact number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Pickup Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.pickup_address}
              onChangeText={(value) => handleInputChange('pickup_address', value)}
              placeholder="Enter pickup address"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Special Requests */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Special Requests</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.special_requests}
              onChangeText={(value) => handleInputChange('special_requests', value)}
              placeholder="Any special requests or requirements"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title={loading ? 'Creating Booking...' : 'Submit Booking'}
              onPress={handleSubmit}
              disabled={loading}
              style={styles.submitButton}
            />
          </View>
        </View>
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.booking_date}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${formData.pickup_time}`)}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RequestBookingScreen;

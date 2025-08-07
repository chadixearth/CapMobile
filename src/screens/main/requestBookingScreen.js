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
  Modal,
} from 'react-native';
// Removed DateTimePicker import - using basic inputs instead
import { createBooking } from '../../services/tourpackage/requestBooking';
import { tourPackageService } from '../../services/tourpackage/fetchPackage';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import Button from '../../components/Button';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';
import { supabase } from '../../services/supabase';

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
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [bookingReference, setBookingReference] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
      const packages = await tourPackageService.getAllPackages();
      setPackages(packages);
    } catch (error) {
      console.error('Error loading packages:', error);
      setErrorMessage('Failed to load tour packages');
      setShowErrorModal(true);
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



  const validateForm = () => {
    const requiredFields = ['package_id', 'booking_date', 'number_of_pax', 'total_amount'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setErrorMessage(`Please fill in ${field.replace('_', ' ')}`);
        setShowErrorModal(true);
        return false;
      }
    }

    if (formData.number_of_pax <= 0) {
      setErrorMessage('Number of passengers must be greater than 0');
      setShowErrorModal(true);
      return false;
    }

    const selectedPackageForValidation = packages.find(p => p.id === formData.package_id);
    if (selectedPackageForValidation && selectedPackageForValidation.max_pax && formData.number_of_pax > selectedPackageForValidation.max_pax) {
      setErrorMessage(`Maximum passengers allowed: ${selectedPackageForValidation.max_pax}`);
      setShowErrorModal(true);
      return false;
    }

    const bookingDate = new Date(formData.booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      setErrorMessage('Booking date cannot be in the past');
      setShowErrorModal(true);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
             if (userError || !user) {
         setErrorMessage('Please log in to create a booking');
         setShowErrorModal(true);
         return;
       }

      // Format the booking data
      const bookingData = {
        ...formData,
        booking_date: formData.booking_date.toISOString().split('T')[0],
        customer_id: user.id,
      };

      const response = await createBooking(bookingData);
      
                    if (response.success) {
         setBookingReference(response.data?.booking_reference || 'N/A');
         setShowSuccessModal(true);
       } else {
         setErrorMessage(response.error || 'Failed to create booking');
         setShowErrorModal(true);
       }
     } catch (error) {
       console.error('Error creating booking:', error);
       setErrorMessage(error.message || 'Failed to create booking');
       setShowErrorModal(true);
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
            <TouchableOpacity
              style={styles.pickerContainer}
              onPress={() => setShowPackagePicker(true)}
            >
              <Text style={styles.pickerText}>
                {formData.package_id ? 
                  packages.find(p => p.id === formData.package_id)?.package_name || 'Select a package' :
                  'Select a package'
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Booking Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Booking Date *</Text>
            <TextInput
              style={styles.input}
              value={formatDate(formData.booking_date)}
              placeholder="YYYY-MM-DD"
              onChangeText={(text) => {
                const date = new Date(text);
                if (!isNaN(date.getTime())) {
                  setFormData(prev => ({
                    ...prev,
                    booking_date: date,
                  }));
                }
              }}
            />
          </View>

          {/* Pickup Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Time</Text>
            <TextInput
              style={styles.input}
              value={formData.pickup_time}
              placeholder="HH:MM (24-hour format)"
              onChangeText={(text) => {
                setFormData(prev => ({
                  ...prev,
                  pickup_time: text,
                }));
              }}
            />
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



             {loading && (
         <View style={styles.loadingOverlay}>
           <ActivityIndicator size="large" color="#007AFF" />
         </View>
       )}

       {/* Package Picker Modal */}
       <Modal
         visible={showPackagePicker}
         transparent={true}
         animationType="slide"
         onRequestClose={() => setShowPackagePicker(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Select Tour Package</Text>
               <TouchableOpacity
                 onPress={() => setShowPackagePicker(false)}
                 style={styles.closeButton}
               >
                 <Text style={styles.closeButtonText}>✕</Text>
               </TouchableOpacity>
             </View>
             <ScrollView style={styles.modalScrollView}>
               {packages.map((pkg) => (
                 <TouchableOpacity
                   key={pkg.id}
                   style={styles.packageOption}
                   onPress={() => {
                     handleInputChange('package_id', pkg.id);
                     setShowPackagePicker(false);
                   }}
                 >
                   <Text style={styles.packageOptionTitle}>{pkg.package_name}</Text>
                   <Text style={styles.packageOptionPrice}>₱{pkg.price}</Text>
                   <Text style={styles.packageOptionDescription}>{pkg.description}</Text>
                 </TouchableOpacity>
               ))}
             </ScrollView>
           </View>
         </View>
               </Modal>

        {/* Success Modal */}
        <SuccessModal
          visible={showSuccessModal}
          title="Booking Successful!"
          message={`Your booking has been created successfully!\n\nBooking Reference: ${bookingReference}`}
          primaryActionText="Go Home"
          onClose={() => setShowSuccessModal(false)}
          primaryAction={() => {
            setShowSuccessModal(false);
            navigation.navigate('Main');
          }}
        />

        {/* Error Modal */}
        <ErrorModal
          visible={showErrorModal}
          title="Booking Error"
          message={errorMessage}
          primaryActionText="OK"
          onClose={() => setShowErrorModal(false)}
        />
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
    padding: 12,
    justifyContent: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  packageOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  packageOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  packageOptionPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  packageOptionDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});

export default RequestBookingScreen;

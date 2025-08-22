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
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import SuccessModal from '../../components/SuccessModal';
import ErrorModal from '../../components/ErrorModal';
import { supabase } from '../../services/supabase';
import { getCurrentUser } from '../../services/authService';

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
    contact_email: '',
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

  // Ensure pickup_time is in HH:MM:SS and valid
  const sanitizeTime = (timeStr) => {
    if (typeof timeStr !== 'string') return '09:00:00';
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return '09:00:00';
    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return '09:00:00';
    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  };

  useEffect(() => {
    if (!packageData) {
      loadPackages();
    }
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
      const pkg = selectedPackage || packages.find(p => p.id === (field === 'package_id' ? value : formData.package_id));
      if (pkg) {
        const maxPax = pkg.max_pax ? parseInt(pkg.max_pax) : null;
        const desiredPax = field === 'number_of_pax' ? value : formData.number_of_pax;
        const clampedPax = maxPax ? Math.min(desiredPax, maxPax) : desiredPax;
        const newTotal = (Number(pkg.price) || 0) * clampedPax;
        setFormData(prev => ({
          ...prev,
          number_of_pax: clampedPax,
          total_amount: newTotal,
          pickup_address: pkg.pickup_location || prev.pickup_address,
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

    // Validate pickup_time format HH:MM or HH:MM:SS
    const timeOk = typeof formData.pickup_time === 'string' && /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.test(formData.pickup_time.trim());
    if (!timeOk) {
      setErrorMessage('Pickup time must be in HH:MM format');
      setShowErrorModal(true);
      return false;
    }

    const selectedPackageForValidation = packages.find(p => p.id === formData.package_id) || selectedPackage;
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

    // Contact number validation (PH): starts with 09 or 63 and 10-13 digits total
    if (formData.contact_number) {
      const cn = String(formData.contact_number).replace(/\D/g, '');
      const startsValid = cn.startsWith('09') || cn.startsWith('63');
      if (!startsValid) {
        setErrorMessage('Contact number must start with 09 or 63');
        setShowErrorModal(true);
        return false;
      }
      const len = cn.length;
      if (len < 10 || len > 13) {
        setErrorMessage('Contact number length is invalid');
        setShowErrorModal(true);
        return false;
      }
    }

    // Email validation (basic @ presence)
    if (formData.contact_email && !String(formData.contact_email).includes('@')) {
      setErrorMessage('Please enter a valid email address');
      setShowErrorModal(true);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get current user (prefer app auth, fallback to Supabase)
      let userId = null;
      const currentUser = await getCurrentUser();
      if (currentUser && currentUser.id) {
        userId = currentUser.id;
      } else {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user && user.id) {
          userId = user.id;
        }
      }

      if (!userId) {
        setErrorMessage('Please log in to create a booking');
        setShowErrorModal(true);
        return;
      }

      // Build a strict payload with validated types
      const bookingData = {
        package_id: formData.package_id,
        customer_id: userId,
        booking_date: formData.booking_date.toISOString().split('T')[0],
        pickup_time: sanitizeTime(formData.pickup_time),
        number_of_pax: Number(formData.number_of_pax) || 1,
        total_amount: Number(formData.total_amount) || 0,
        special_requests: formData.special_requests || '',
        contact_number: String(formData.contact_number || ''),
        pickup_address: formData.pickup_address || '',
        // contact_email is intentionally omitted to avoid backend mis-parsing into time
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
      // Provide a clearer message on timeouts/aborts
      const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
      setErrorMessage(
        isAbort
          ? 'Request timed out. Please check your connection and try again.'
          : (error.message || 'Failed to create booking')
      );
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
      <TARTRACKHeader title="Request Booking" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Package Summary Card */}
          {selectedPackage && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle} numberOfLines={1}>{selectedPackage.package_name}</Text>
                <Text style={styles.summaryPrice}>₱{Number(selectedPackage.price || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryMeta}>
                {selectedPackage.duration_hours ? (
                  <View style={styles.metaPill}>
                    <Ionicons name="time-outline" size={12} color="#6B2E2B" />
                    <Text style={styles.metaText}>{selectedPackage.duration_hours}h</Text>
                  </View>
                ) : null}
                {selectedPackage.max_pax ? (
                  <View style={styles.metaPill}>
                    <Ionicons name="people-outline" size={12} color="#6B2E2B" />
                    <Text style={styles.metaText}>{selectedPackage.max_pax}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Tour Package</Text>
          <View style={[styles.pickerContainer, { borderColor: '#eee' }]}> 
            <Text style={styles.pickerText} numberOfLines={1}>
              {selectedPackage?.package_name || 'Selected package'}
            </Text>
          </View>

          {/* Date & Time row */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }] }>
              <Text style={styles.label}>Booking Date *</Text>
              <TextInput
                style={styles.input}
                value={formatDate(formData.booking_date)}
                placeholder="YYYY-MM-DD"
                onChangeText={(text) => {
                  const date = new Date(text);
                  if (!isNaN(date.getTime())) {
                    setFormData(prev => ({ ...prev, booking_date: date }));
                  }
                }}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }] }>
              <Text style={styles.label}>Pickup Time</Text>
              <TextInput
                style={styles.input}
                value={formData.pickup_time}
                placeholder="HH:MM"
                onChangeText={(text) => setFormData(prev => ({ ...prev, pickup_time: text }))}
              />
            </View>
          </View>

          {/* Pax stepper */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Passengers *</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => handleInputChange('number_of_pax', Math.max(1, formData.number_of_pax - 1))}>
                <Ionicons name="remove" size={18} color="#6B2E2B" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{formData.number_of_pax}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => handleInputChange('number_of_pax', formData.number_of_pax + 1)}>
                <Ionicons name="add" size={18} color="#6B2E2B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₱{Number(formData.total_amount || 0).toFixed(2)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Contact</Text>

          {/* Contact Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_number}
              onChangeText={(value) => handleInputChange('contact_number', value)}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
            />
          </View>

          {/* Contact Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Email</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_email}
              onChangeText={(value) => handleInputChange('contact_email', value)}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Pickup Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.pickup_address}
              onChangeText={(value) => handleInputChange('pickup_address', value)}
              placeholder="Your pickup address"
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
              placeholder="Any special requests or notes"
              multiline
              numberOfLines={4}
            />
          </View>

          <Button
            title={loading ? 'Processing...' : 'Submit Booking'}
            onPress={handleSubmit}
            disabled={loading}
          />
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
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
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
    borderColor: '#E0CFC2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginRight: 8,
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0CFC2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    color: '#6B2E2B',
    fontWeight: '800',
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#6B2E2B',
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
    padding: 14,
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
    color: '#6B2E2B',
    marginBottom: 4,
  },
  packageOptionDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '700',
    color: '#6B2E2B',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  summaryPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6B2E2B',
  },
  summaryMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
  },
  metaText: {
    color: '#6B2E2B',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default RequestBookingScreen;

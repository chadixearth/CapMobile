import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { createBooking } from '../../services/tourpackage/requestBooking';
import { tourPackageService } from '../../services/tourpackage/fetchPackage';
import { Ionicons } from '@expo/vector-icons';

import SuccessModal from '../../components/SuccessModal';
import * as Routes from '../../constants/routes';
import { supabase } from '../../services/supabase';
import { getCurrentUser } from '../../services/authService';
import { useError } from '../../components/ErrorProvider';
import ErrorHandlingService from '../../services/errorHandlingService';

const MAROON = '#6B2E2B';
const BG = '#F7F4F2';
const CARD = '#FFFFFF';
const BORDER = '#E9DAD1';
const MUTED = '#6B7280';
const TEXT = '#1F2937';

const RequestBookingScreen = ({ route, navigation }) => {
  const { packageId, packageData } = route.params || {};
  const { showError, showSuccess } = useError();

  // Set navigation reference for error handling
  React.useEffect(() => {
    ErrorHandlingService.setNavigationRef(navigation);
  }, [navigation]);

  // Form state
  const [formData, setFormData] = useState({
    package_id: packageId || '',
    customer_id: '',
    booking_date: new Date(),
    pickup_time: '09:00',
    number_of_pax: 1,
    total_amount: 0,
    special_requests: '',
    contact_number: '',
    contact_email: '',
    pickup_address: '',
  });

  const [packages, setPackages] = useState([]); // kept for validation fallback, no dropdown
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingReference, setBookingReference] = useState('');
  // Removed error modal states - using ErrorProvider instead



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
    // Keep this in case screen can be reached without full packageData
    if (!packageData && packageId) {
      loadPackages();
    }
    if (packageData) {
      setSelectedPackage(packageData);
      setFormData((prev) => ({
        ...prev,
        package_id: packageData.id,
        pickup_address: packageData.pickup_location || '',
        total_amount: packageData.price || 0,
      }));
    }
  }, [packageData, packageId]);

  const loadPackages = async () => {
    try {
      const list = await tourPackageService.getAllPackages();
      setPackages(list);
      // If we only got an ID, bind the full object so hero/pills work
      if (!packageData && packageId) {
        const found = list.find((p) => p.id === packageId);
        if (found) {
          setSelectedPackage(found);
          setFormData((prev) => ({
            ...prev,
            package_id: found.id,
            pickup_address: found.pickup_location || prev.pickup_address,
            total_amount: found.price || prev.total_amount,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      ErrorHandlingService.handleError('Failed to load tour packages', {
        title: 'Loading Error',
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Recalculate total when pax changes
    if (field === 'number_of_pax') {
      const pkg = selectedPackage;
      if (pkg) {
        const maxPax = pkg.max_pax ? parseInt(pkg.max_pax) : null;
        const desiredPax = value;
        const clampedPax = maxPax ? Math.min(desiredPax, maxPax) : desiredPax;
        const newTotal = (Number(pkg.price) || 0) * clampedPax;
        setFormData((prev) => ({
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
        showError(`Please fill in ${field.replace('_', ' ')}`, {
          title: 'Missing Information',
          type: 'warning',
        });
        return false;
      }
    }

    if (formData.number_of_pax <= 0) {
      showError('Number of passengers must be greater than 0', {
        title: 'Invalid Passenger Count',
        type: 'warning',
      });
      return false;
    }

    // Validate pickup_time format HH:MM or HH:MM:SS
    const timeOk =
      typeof formData.pickup_time === 'string' &&
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.test(formData.pickup_time.trim());
    if (!timeOk) {
      showError('Pickup time must be in HH:MM format', {
        title: 'Invalid Time Format',
        type: 'warning',
      });
      return false;
    }

    const selectedPackageForValidation =
      selectedPackage || packages.find((p) => p.id === formData.package_id);
    if (
      selectedPackageForValidation &&
      selectedPackageForValidation.max_pax &&
      formData.number_of_pax > selectedPackageForValidation.max_pax
    ) {
      showError(`Maximum passengers allowed: ${selectedPackageForValidation.max_pax}`, {
        title: 'Passenger Limit Exceeded',
        type: 'warning',
      });
      return false;
    }

    const bookingDate = new Date(formData.booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      showError('Booking date cannot be in the past', {
        title: 'Invalid Date',
        type: 'warning',
      });
      return false;
    }

    // Contact number validation (PH)
    if (formData.contact_number) {
      const cn = String(formData.contact_number).replace(/\D/g, '');
      const startsValid = cn.startsWith('09') || cn.startsWith('63');
      if (!startsValid) {
        showError('Contact number must start with 09 or 63', {
          title: 'Invalid Contact Number',
          type: 'warning',
        });
        return false;
      }
      const len = cn.length;
      if (len < 10 || len > 13) {
        showError('Contact number length is invalid', {
          title: 'Invalid Contact Number',
          type: 'warning',
        });
        return false;
      }
    }

    // Email validation
    if (formData.contact_email && !String(formData.contact_email).includes('@')) {
      showError('Please enter a valid email address', {
        title: 'Invalid Email',
        type: 'warning',
      });
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
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (!userError && user && user.id) {
          userId = user.id;
        }
      }

      if (!userId) {
        ErrorHandlingService.handleAuthError('unauthorized', {
          title: 'Login Required',
          customMessage: 'Please log in to create a booking',
        });
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
        // contact_email intentionally omitted
      };

      const response = await createBooking(bookingData);

      if (response.success) {
        const bookingId = response.data?.id || response.data?.booking_id;
        setBookingReference(response.data?.booking_reference || 'N/A');
        
        // Navigate to payment screen instead of showing success modal
        if (bookingId && formData.total_amount > 0) {
          navigation.navigate(Routes.PAYMENT, {
            bookingId: bookingId,
            bookingData: {
              packageName: selectedPackage?.package_name || 'Tour Package',
              bookingDate: formatDate(formData.booking_date),
              numberOfPax: formData.number_of_pax,
            },
            amount: formData.total_amount,
            currency: 'PHP'
          });
        } else {
          // Fallback to success modal if no payment needed
          setShowSuccessModal(true);
        }
      } else {
        ErrorHandlingService.handleBookingError('booking_failed', {
          customMessage: response.error || 'Failed to create booking',
        });
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      
      // Check for session expired error
      if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
        ErrorHandlingService.handleBookingError('session_expired_booking');
        return;
      }
      
      const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
      const errorMessage = isAbort
        ? 'Request timed out. Please check your connection and try again.'
        : error.message || 'Failed to create booking';
        
      ErrorHandlingService.handleBookingError('booking_failed', {
        customMessage: errorMessage,
        onRetry: () => handleSubmit(), // Allow retry
      });
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

  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const formatTimeHM = (date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };


  // ——— UI helpers (pure presentation) ———
  const pkgImage = useMemo(() => {
    const p = selectedPackage || {};
    return p.image_url || p.cover_image || p.photo_url || p.thumbnail || p.image || null;
  }, [selectedPackage]);

  const pills = useMemo(() => {
    const arr = [];
    if (selectedPackage?.duration_hours)
      arr.push({ icon: 'time-outline', text: `${selectedPackage.duration_hours}h` });
    if (selectedPackage?.max_pax)
      arr.push({ icon: 'people-outline', text: `${selectedPackage.max_pax}` });
    return arr;
  }, [selectedPackage]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* HERO with background image */}
      <View style={styles.heroWrap}>
        <ImageBackground
          source={pkgImage ? { uri: pkgImage } : undefined}
          style={styles.hero}
          imageStyle={styles.heroImg}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color={CARD} />
            </TouchableOpacity>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {selectedPackage?.package_name || 'Tour Package'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Pills + price */}
          <View style={styles.pillsRow}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {pills.map((p, i) => (
                <View key={i} style={styles.metaPill}>
                  <Ionicons name={p.icon} size={12} color={MAROON} />
                  <Text style={styles.metaText}>{p.text}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.priceTop}>
              ₱ {Number(selectedPackage?.price || formData.total_amount || 0).toFixed(2)}
            </Text>
          </View>

          {/* About card */}
          {selectedPackage && (
            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>About this Package</Text>
              {!!selectedPackage.description && (
                <Text style={styles.aboutText} numberOfLines={6}>
                  {String(selectedPackage.description).trim()}
                </Text>
              )}
            </View>
          )}
        </ImageBackground>
      </View>

      {/* CONTENT */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          {/* Tour Package (read-only) */}
          <Text style={styles.sectionTitle}>Tour Package</Text>
          <View style={styles.readonlyPackageRow}>
            <Text style={styles.pickerText} numberOfLines={1}>
              {selectedPackage?.package_name || 'Selected package'}
            </Text>
          </View>

          {/* Date & Time row */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Booking Date *</Text>
              <TextInput
                style={styles.input}
                value={formatDate(formData.booking_date)}
                onChangeText={(value) => {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    setFormData(prev => ({ ...prev, booking_date: date }));
                  }
                }}
                placeholder="MM/DD/YYYY"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Pickup Time</Text>
              <TextInput
                style={styles.input}
                value={formData.pickup_time}
                onChangeText={(value) => handleInputChange('pickup_time', value)}
                placeholder="09:00"
              />
            </View>
          </View>

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
            <Text style={styles.label}>Special Request</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.special_requests}
              onChangeText={(value) => handleInputChange('special_requests', value)}
              placeholder="Any special request or notes"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalCaption}>Total Price</Text>
          <Text style={styles.totalValue}>₱ {Number(formData.total_amount || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() =>
              handleInputChange('number_of_pax', Math.max(1, formData.number_of_pax - 1))
            }
          >
            <Ionicons name="remove" size={18} color={MAROON} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{formData.number_of_pax}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => handleInputChange('number_of_pax', formData.number_of_pax + 1)}
          >
            <Ionicons name="add" size={18} color={MAROON} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.bookBtn} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.bookBtnText}>{loading ? 'Processing…' : 'Book'}</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={MAROON} />
        </View>
      )}

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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  heroWrap: { width: '100%', height: 220, backgroundColor: '#f5f5f5' },
  hero: { flex: 1, justifyContent: 'flex-end' },
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroTopRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MAROON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    flex: 1,
    textAlign: 'center',
    color: CARD,
    fontWeight: '700',
    fontSize: 14,
  },
  pillsRow: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceTop: { color: CARD, fontWeight: '800', fontSize: 14 },
  aboutCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 12,
    margin: 16,
  },
  aboutTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 6 },
  aboutText: { fontSize: 12, color: MUTED, lineHeight: 16 },

  scrollView: { flex: 1 },
  formContainer: { padding: 16 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginTop: 8,
    marginBottom: 10,
  },

  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 6 },
  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT,
  },
  inputButton: {
    justifyContent: 'center',
  },
  inputButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputButtonText: {
    fontSize: 14,
    color: TEXT,
    fontWeight: '600',
  },
  textArea: { height: 84, textAlignVertical: 'top' },

  readonlyPackageRow: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerText: { fontSize: 14, color: TEXT, flex: 1, marginRight: 8 },

  row: { flexDirection: 'row', alignItems: 'center' },

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
  metaText: { color: MAROON, fontSize: 11, fontWeight: '700' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalCaption: { fontSize: 11, color: MUTED },
  totalValue: { fontSize: 16, fontWeight: '800', color: TEXT },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
    marginRight: 6,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { minWidth: 20, textAlign: 'center', fontWeight: '700', color: MAROON },

  bookBtn: {
    backgroundColor: MAROON,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  bookBtnText: { color: '#fff', fontWeight: '700' },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RequestBookingScreen;

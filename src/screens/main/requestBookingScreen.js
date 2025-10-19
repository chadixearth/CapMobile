import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  InteractionManager,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createBooking } from '../../services/tourpackage/requestBooking';
import { tourPackageService } from '../../services/tourpackage/fetchPackage';
import { Ionicons } from '@expo/vector-icons';

import SuccessModal from '../../components/SuccessModal';
import * as Routes from '../../constants/routes';
import { supabase } from '../../services/supabase';
import { getCurrentUser } from '../../services/authService';
import { useError } from '../../components/ErrorProvider';
import ErrorHandlingService from '../../services/errorHandlingService';
import NotificationService from '../../services/notificationService';

const MAROON = '#6B2E2B';
const BG = '#F7F4F2';
const CARD = '#FFFFFF';
const BORDER = '#E9DAD1';
const MUTED = '#6B7280';
const TEXT = '#1F2937';
const HAIRLINE = '#ECECEC';
const MUTED_BG = '#FAFAFA';

const SCROLL_PADDING = 100; // how far above the field to land when focusing

const RequestBookingScreen = ({ route, navigation }) => {
  const { packageId, packageData } = route.params || {};
  const { showError, showSuccess } = useError();

  // Scroll + field position refs
  const scrollRef = useRef(null);
  const fieldPositions = useRef({}); // { fieldName: y }

  const registerField = (name) => (e) => {
    fieldPositions.current[name] = e.nativeEvent.layout.y;
  };

  const focusField = (name) => {
    const y = fieldPositions.current[name] ?? 0;
    InteractionManager.runAfterInteractions(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_PADDING), animated: true });
    });
  };

  // Bottom bar hide/show while typing
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const bottomBarAnim = useRef(new Animated.Value(0)).current; // 0 = shown, 1 = hidden

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardVisible(true);
      Animated.timing(bottomBarAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvt, () => {
      Animated.timing(bottomBarAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setKeyboardVisible(false));
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomBarAnim]);

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

  });

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingReference, setBookingReference] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
    if (!packageData && packageId) {
      loadPackages();
    }
    if (packageData) {
      setSelectedPackage(packageData);
      setFormData((prev) => ({
        ...prev,
        package_id: packageData.id,
        total_amount: packageData.price || 0,
      }));
    }
  }, [packageData, packageId]);

  const loadPackages = async () => {
    try {
      const list = await tourPackageService.getAllPackages();
      setPackages(list);
      if (!packageData && packageId) {
        const found = list.find((p) => p.id === packageId);
        if (found) {
          setSelectedPackage(found);
          setFormData((prev) => ({
            ...prev,
            package_id: found.id,
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
        if (['number_of_pax', 'contact_number', 'contact_email', 'special_requests'].includes(field)) {
          focusField(field);
        }
        return false;
      }
    }

    if (formData.number_of_pax <= 0) {
      showError('Number of passengers must be greater than 0', {
        title: 'Invalid Passenger Count',
        type: 'warning',
      });
      focusField('number_of_pax');
      return false;
    }

    // Only validate pickup time if package doesn't have start_time set
    if (!selectedPackage?.start_time) {
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
      focusField('number_of_pax');
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

    if (formData.contact_number) {
      const cn = String(formData.contact_number).replace(/\D/g, '');
      const startsValid = cn.startsWith('09') || cn.startsWith('63');
      if (!startsValid) {
        showError('Contact number must start with 09 or 63', {
          title: 'Invalid Contact Number',
          type: 'warning',
        });
        focusField('contact_number');
        return false;
      }
      const len = cn.length;
      if (len < 10 || len > 13) {
        showError('Contact number length is invalid', {
          title: 'Invalid Contact Number',
          type: 'warning',
        });
        focusField('contact_number');
        return false;
      }
    }

    if (formData.contact_email && !String(formData.contact_email).includes('@')) {
      showError('Please enter a valid email address', {
        title: 'Invalid Email',
        type: 'warning',
      });
      focusField('contact_email');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
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
        setLoading(false);
        ErrorHandlingService.handleAuthError('unauthorized', {
          title: 'Login Required',
          customMessage: 'Please log in to proceed with booking',
        });
        return;
      }

      const bookingData = {
        package_id: formData.package_id,
        customer_id: userId,
        booking_date: formData.booking_date.toISOString().split('T')[0],
        pickup_time: selectedPackage?.start_time ? sanitizeTime(selectedPackage.start_time) : sanitizeTime(formData.pickup_time),
        number_of_pax: Number(formData.number_of_pax) || 1,
        total_amount: Number(formData.total_amount) || 0,
        special_requests: formData.special_requests || '',
        contact_number: String(formData.contact_number || ''),
      };

      // Create booking without payment
      const result = await createBooking(bookingData);
      
      if (result && result.success) {
        const bookingRef = result.data?.booking_reference || result.data?.id || 'N/A';
        setBookingReference(bookingRef);
        setShowSuccessModal(true);
      } else {
        throw new Error(result?.error || 'Failed to create booking');
      }
      
      setLoading(false);
    } catch (error) {
      setLoading(false);

      const errorMessage = error.message || 'Failed to prepare booking';
      
      // Handle expired package error gracefully
      if (errorMessage.includes('Tour package has expired') || errorMessage.includes('cannot be booked')) {
        console.log('Booking prevented - package expired');
        showError('This tour package has expired and is no longer available for booking. Please select a different package.', {
          title: 'Package Expired',
          type: 'warning',
        });
      }
      // Handle driver availability warnings - but show success if booking was created
      else if (errorMessage.includes('not available on') || 
               errorMessage.includes('driver not available') || 
               errorMessage.includes('schedule not set') ||
               errorMessage.includes('Driver is not available') ||
               errorMessage.includes('Tour package is not available')) {
        
        // Check if this is actually a success message disguised as an error
        if (errorMessage.includes('Your booking request has been submitted')) {
          console.log('Booking succeeded despite availability warning');
          setBookingReference('PENDING');
          setShowSuccessModal(true);
        } else {
          console.log('Driver availability issue - showing helpful message');
          const dayName = formData.booking_date.toLocaleDateString('en-US', { weekday: 'long' });
          showError(`Your booking request has been submitted! We'll notify available drivers and get back to you soon. If no driver accepts within 24 hours, we'll suggest alternative dates.`, {
            title: 'Booking Submitted',
            type: 'info',
          });
          // Still show success modal since booking was likely created
          setTimeout(() => {
            setBookingReference('PENDING');
            setShowSuccessModal(true);
          }, 2000);
        }
      }
      else {
        console.error('Error preparing booking:', error);
        showError(errorMessage, {
          title: 'Booking Error',
          type: 'error',
        });
      }
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

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, booking_date: selectedDate }));
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const timeString = formatTimeHM(selectedTime);
      setFormData((prev) => ({ ...prev, pickup_time: timeString }));
    }
  };

  // --- Photos for hero background ---
  const photos = useMemo(() => {
    const fromPkg = selectedPackage?.photos;
    if (Array.isArray(fromPkg) && fromPkg.length > 0) return fromPkg;
    const fallback = [
      selectedPackage?.image_url,
      selectedPackage?.cover_image,
      selectedPackage?.photo_url,
      selectedPackage?.thumbnail,
      selectedPackage?.image,
    ].filter(Boolean);
    return fallback.length ? [fallback[0]] : [];
  }, [selectedPackage]);

  const heroImageSource = useMemo(() => {
    if (!photos || photos.length === 0) return undefined;
    const first = photos[0];
    return typeof first === 'string' ? { uri: first } : first;
  }, [photos]);

  const pills = useMemo(() => {
    const arr = [];
    if (selectedPackage?.duration_hours)
      arr.push({ icon: 'time-outline', text: `${selectedPackage.duration_hours}h` });
    if (selectedPackage?.max_pax)
      arr.push({ icon: 'people-outline', text: `${selectedPackage.max_pax}` });
    return arr;
  }, [selectedPackage]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      {/* HERO with background image */}
      <View style={styles.heroWrap}>
        <ImageBackground
          source={heroImageSource}
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

          {/* About card with pills in the upper-right */}
          {selectedPackage && (
            <View style={styles.aboutCard}>
              <View style={styles.aboutHeader}>
                <Text style={styles.aboutTitle}>About this Package</Text>
                {pills.length > 0 && (
                  <View style={styles.pillsRowInside}>
                    {pills.map((p, i) => (
                      <View key={i} style={styles.metaPill}>
                        <Ionicons name={p.icon} size={12} color={MAROON} />
                        <Text style={styles.metaText}>{p.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

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
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: keyboardVisible ? 24 : 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formOuterPad}>
          {/* FORM CARD — same motif as receipt details card */}
          <View style={styles.formCard}>
            <View style={styles.formAccent} />
            <Text style={styles.sheetTitle}>Booking Details</Text>

            {/* Package (readonly) */}
            <View style={styles.readonlyPackageRow}>
              <Ionicons name="pricetag-outline" size={16} color={MAROON} style={{ marginRight: 8 }} />
              <Text style={styles.pickerText} numberOfLines={1}>
                {selectedPackage?.package_name || 'Selected package'}
              </Text>
            </View>

            <View style={styles.dottedDivider} />

            {/* Date & Time row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: selectedPackage?.start_time ? 0 : 8 }]}>
                <Text style={styles.label}>Booking Date *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.inputButton]}
                  onPress={() => setShowDatePicker(true)}
                  onLayout={registerField('booking_date')}
                  onFocus={() => focusField('booking_date')}
                >
                  <View style={styles.inputButtonContent}>
                    <Ionicons name="calendar-outline" size={16} color={MAROON} />
                    <Text style={styles.inputButtonText}>
                      {formatDate(formData.booking_date)}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.helperText}>
                  💡 You can book any date - we'll notify available drivers
                </Text>
              </View>

              {!selectedPackage?.start_time && (
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Pickup Time</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.inputButton]}
                    onPress={() => setShowTimePicker(true)}
                    onLayout={registerField('pickup_time')}
                    onFocus={() => focusField('pickup_time')}
                  >
                    <View style={styles.inputButtonContent}>
                      <Ionicons name="time-outline" size={16} color={MAROON} />
                      <Text style={styles.inputButtonText}>
                        {formData.pickup_time}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Show package start time if set */}
            {selectedPackage?.start_time && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Package Start Time</Text>
                <View style={styles.readonlyField}>
                  <Ionicons name="time-outline" size={16} color={MAROON} style={{ marginRight: 8 }} />
                  <Text style={styles.readonlyText}>
                    {selectedPackage.start_time}
                  </Text>
                </View>
              </View>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={formData.booking_date}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={new Date(`2000-01-01T${formData.pickup_time}:00`)}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            <View style={styles.dottedDivider} />

            {/* Contacts */}
            <View style={styles.inputGroup} onLayout={registerField('contact_number')}>
              <Text style={styles.label}>Contact Number</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_number}
                onChangeText={(value) => handleInputChange('contact_number', value)}
                placeholder="09XX XXX XXXX"
                keyboardType="phone-pad"
                onFocus={() => focusField('contact_number')}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup} onLayout={registerField('contact_email')}>
              <Text style={styles.label}>Contact Email</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_email}
                onChangeText={(value) => handleInputChange('contact_email', value)}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => focusField('contact_email')}
                returnKeyType="next"
              />
            </View>

            <View style={styles.dottedDivider} />

            {/* Package Pickup Location (readonly) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Package Pickup Location</Text>
              <View style={styles.readonlyField}>
                <Ionicons name="location-outline" size={16} color={MAROON} style={{ marginRight: 8 }} />
                <Text style={styles.readonlyText}>
                  {selectedPackage?.pickup_location || 'Pickup location will be provided'}
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup} onLayout={registerField('special_requests')}>
              <Text style={styles.label}>Special Request</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.special_requests}
                onChangeText={(value) => handleInputChange('special_requests', value)}
                placeholder="Any special request or notes"
                multiline
                numberOfLines={4}
                onFocus={() => focusField('special_requests')}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar (animated hide while typing) */}
      <Animated.View
        pointerEvents={keyboardVisible ? 'none' : 'auto'}
        style={[
          styles.bottomBar,
          {
            opacity: bottomBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
            transform: [
              {
                translateY: bottomBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 40], // slide down slightly when hiding
                }),
              },
            ],
          },
        ]}
      >
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
          <Text style={styles.bookBtnText}>{loading ? 'Submitting…' : 'Submit Request'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={MAROON} />
        </View>
      )}

      <SuccessModal
        visible={showSuccessModal}
        title="Booking Request Submitted!"
        message={`Your booking request has been submitted successfully!\n\nBooking Reference: ${bookingReference}\n\nYou will be notified when a driver accepts your booking. Payment will be required after driver acceptance.`}
        primaryActionText="View My Bookings"
        secondaryActionText="Go Home"
        onClose={() => setShowSuccessModal(false)}
        primaryAction={() => {
          setShowSuccessModal(false);
          navigation.navigate('Main', { screen: 'Book' });
        }}
        secondaryAction={() => {
          setShowSuccessModal(false);
          navigation.navigate('Main');
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  /* HERO */
  heroWrap: { width: '100%', height: 210, backgroundColor: '#f5f5f5' },
  hero: { flex: 1, justifyContent: 'flex-end' },
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
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
    backgroundColor: 'rgba(82, 78, 78, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { flex: 1, textAlign: 'center', color: CARD, fontWeight: '700', fontSize: 14 },

  /* About card + pills */
  aboutCard: {
    backgroundColor: 'rgba(82, 78, 78, 0.52)',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aboutTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,1)' },
  pillsRowInside: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  aboutText: { fontSize: 12, color: 'rgba(255,255,255,1)', lineHeight: 16 },

  /* CONTENT */
  scrollView: { flex: 1 },
  formOuterPad: { padding: 16 },

  /* FORM CARD — mirrors the receipt details motif */
  formCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  formAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: MAROON },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 10 },

  dottedDivider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    borderBottomColor: HAIRLINE,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },

  readonlyPackageRow: {
    backgroundColor: MUTED_BG,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerText: { fontSize: 14, color: TEXT, flex: 1, marginRight: 8, fontWeight: '700' },

  /* Rows + inputs */
  row: { flexDirection: 'row', alignItems: 'center' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 6 },
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
  inputButton: { justifyContent: 'center' },
  inputButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputButtonText: { fontSize: 14, color: TEXT, fontWeight: '700' },
  textArea: { height: 96, textAlignVertical: 'top' },
  readonlyField: {
    backgroundColor: MUTED_BG,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readonlyText: {
    fontSize: 14,
    color: TEXT,
    flex: 1,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    fontStyle: 'italic',
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
  metaText: { color: MAROON, fontSize: 11, fontWeight: '700' },

  /* Bottom bar */
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

  bookBtn: { backgroundColor: MAROON, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Image,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { getCustomerBookings } from '../../services/tourpackage/requestBooking';
import { getCurrentUser } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { getCustomerCustomRequests } from '../../services/specialpackage/customPackageRequest';
import { createPackageReview, createDriverReview, checkExistingReviews } from '../../services/reviews';
import { getVerificationStatus } from '../../services/tourpackage/bookingVerification';
import { getCancellationPolicy, cancelBooking, calculateCancellationFee } from '../../services/tourpackage/bookingCancellation';
import { useScreenAutoRefresh, invalidateData } from '../../services/dataInvalidationService';
import { apiBaseUrl } from '../../services/networkConfig';

const MAROON = '#6B2E2B';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function BookScreen({ navigation }) {
  const auth = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  // filters
  const [activeFilter, setActiveFilter] = useState('all'); // all | upcoming | completed | cancelled | pending | confirmed
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  // expand map
  const [expandedMap, setExpandedMap] = useState({});

  // custom requests (no separate filter)
  const [customRequests, setCustomRequests] = useState([]);

  // reviews & verification UI state
  const [ratedMap, setRatedMap] = useState({}); // { [bookingId]: { package: bool, driver: bool } }
  const [verificationMap, setVerificationMap] = useState({}); // { [bookingId]: { checked: bool, available: bool, url: string|null } }
  const [viewer, setViewer] = useState({ visible: false, url: null });

  const [ratingModal, setRatingModal] = useState({ visible: false, type: 'package', booking: null });
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  // cancellation state (reworked)
  const [cancelModal, setCancelModal] = useState({
    visible: false,
    booking: null,
    policy: null,
    loading: false,
    error: null,
  });
  const [cancelReason, setCancelReason] = useState('');
  const [ackCancel, setAckCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const QUICK_REASONS = [
    'Change of plans',
    'Booked by mistake',
    'Found a better date',
    'Price concerns',
  ];

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

  // Auto-refresh when data changes
  useScreenAutoRefresh('BOOK_SCREEN', () => {
    console.log('[BookScreen] Auto-refreshing due to data changes');
    if (!auth.loading && auth.isAuthenticated) fetchUserAndBookings();
  });

  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) fetchUserAndBookings();
  }, [auth.loading, auth.isAuthenticated]);

  if (auth.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }
  if (!auth.isAuthenticated) return null;

  const fetchUserAndBookings = async () => {
    try {
      setLoading(true);

      let currentUser = await getCurrentUser();
      let userId = null;

      if (currentUser) {
        setUser(currentUser);
        userId = currentUser.id;
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          Alert.alert('Error', 'Please log in to view your bookings');
          return;
        }
        setUser(user);
        userId = user.id;
      }

      const bookingsData = await getCustomerBookings(userId);

      let processedBookings = [];
      if (Array.isArray(bookingsData)) processedBookings = bookingsData;
      else if (bookingsData?.results) processedBookings = bookingsData.results;
      else if (bookingsData?.data?.bookings) processedBookings = bookingsData.data.bookings;
      else if (bookingsData?.bookings) processedBookings = bookingsData.bookings;
      else if (Array.isArray(bookingsData?.data)) processedBookings = bookingsData.data;
      else processedBookings = [];

      setBookings(processedBookings);
      
      // Debug: Log first booking to see driver data structure
      if (processedBookings.length > 0) {
        console.log('Sample booking data:', JSON.stringify(processedBookings[0], null, 2));
        
        // Log driver-specific fields
        const firstBooking = processedBookings[0];
        console.log('Driver fields:', {
          driver_id: firstBooking.driver_id,
          assigned_driver_id: firstBooking.assigned_driver_id,
          driver: firstBooking.driver,
          assigned_driver: firstBooking.assigned_driver,
          driver_name: firstBooking.driver_name,
          driver_email: firstBooking.driver_email,
          driver_phone: firstBooking.driver_phone
        });
      }

      // Load existing reviews for completed bookings
      try {
        const completedBookings = processedBookings.filter(b => 
          String((b.status || '')).toLowerCase() === 'completed'
        );
        
        for (const booking of completedBookings) {
          if (booking.id) {
            loadExistingReviews(booking);
          }
        }
      } catch (e) {
        console.log('Failed to load existing reviews:', e);
      }

      try {
        const customRes = await getCustomerCustomRequests(userId);
        setCustomRequests(customRes?.success && Array.isArray(customRes?.data) ? customRes.data : []);
      } catch {
        setCustomRequests([]);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', `Failed to load your bookings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndBookings();
    setRefreshing(false);
  };

  // ---------- helpers
  const getStatusColor = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    const paymentStatus = (booking?.payment_status || '').toLowerCase();
    
    // Show payment status if driver assigned and paid
    if (status === 'driver_assigned' && paymentStatus === 'paid') {
      return '#1976d2'; // Blue for paid
    }
    
    switch (status) {
      case 'confirmed': return '#2e7d32';
      case 'driver_assigned': return '#2e7d32';
      case 'pending':   return '#ef6c00';
      case 'cancelled': return '#c62828';
      case 'completed': return '#1565c0';
      case 'in_progress': return '#1976d2';
      case 'no_driver_available': return '#ff9800'; // Orange for timeout
      default:          return '#616161';
    }
  };
  const getStatusIcon = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    const paymentStatus = (booking?.payment_status || '').toLowerCase();
    
    // Show payment icon if driver assigned and paid
    if (status === 'driver_assigned' && paymentStatus === 'paid') {
      return 'card'; // Card icon for paid
    }
    
    switch (status) {
      case 'confirmed': return 'checkmark-circle';
      case 'driver_assigned': return 'checkmark-circle';
      case 'pending':   return 'time';
      case 'cancelled': return 'close-circle';
      case 'completed': return 'checkmark-done-circle';
      case 'in_progress': return 'car';
      case 'no_driver_available': return 'alert-circle';
      default:          return 'help-circle';
    }
  };
  const prettyStatus = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    const paymentStatus = (booking?.payment_status || '').toLowerCase();
    
    // Show 'Paid' if driver assigned and payment completed
    if (status === 'driver_assigned' && paymentStatus === 'paid') {
      return 'Paid';
    }
    
    // Special handling for timeout status
    if (status === 'no_driver_available') {
      return 'No Driver Available';
    }
    
    return (status || 'Unknown').toString().toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : 'N/A';
  const formatTime = (t) => t || 'N/A';
  const formatCurrency = (a) => (a || a === 0) ? `₱${parseFloat(a).toFixed(2)}` : 'N/A';

  const getPackageName = (b) =>
    b?.package_name || b?.package?.package_name || b?.package?.name || b?.tour_package_name || b?.packageTitle || b?.name || null;

  const getPackageDetails = (b) => {
    const p = b?.package || b?.tour_package || {};
    return {
      durationHours: b?.duration_hours ?? p?.duration_hours ?? p?.duration ?? null,
      maxPax:        b?.max_pax ?? p?.max_pax ?? p?.capacity ?? null,
      pickupLocation:b?.pickup_location ?? p?.pickup_location ?? null,
      destination:   b?.destination ?? p?.destination ?? null,
      route:         b?.route ?? p?.route ?? null,
      availableDays: b?.available_days ?? p?.available_days ?? null,
      description:   b?.package_description ?? p?.description ?? null,
    };
  };

  const getBookingDateValue = (b) => b?.booking_date || b?.date || b?.preferred_date || b?.event_date || null;
  const getPickupTimeValue  = (b) => b?.pickup_time || b?.time || b?.event_time || null;
  const getNumPax           = (b) => b?.number_of_pax ?? b?.num_pax ?? b?.pax ?? b?.passengers ?? null;
  const getPickupAddress    = (b) => b?.pickup_address || b?.pickup_location || b?.address || b?.event_address || null;
  const getContactNumber    = (b) => b?.contact_number || b?.contact || b?.phone || b?.customer_phone || null;
  const getTotalAmount      = (b) => b?.total_amount ?? b?.approved_price ?? b?.total_price ?? b?.price ?? null;
  const getBookingReference = (b) => b?.booking_reference || b?.reference || b?.ref || b?.id || null;

  const getDriverName = (b) => {
    // Try multiple possible driver name fields
    const possibleNames = [
      b?.assigned_driver?.name,
      b?.driver?.name, 
      b?.assigned_driver_name,
      b?.driver_name,
      b?.assigned_driver?.full_name,
      b?.driver?.full_name,
      b?.driver_info?.name,
      b?.driver_details?.name
    ];
    
    for (const name of possibleNames) {
      if (name && String(name).trim()) {
        const trimmed = String(name).trim();
        // Skip if it's a generic placeholder
        if (/^(driver|user|admin)$/i.test(trimmed)) continue;
        return trimmed;
      }
    }
    
    return null;
  };
  const getDriverAvatarUrl = (b) => {
    const src = b?.assigned_driver || b?.driver || null;
    const name = getDriverName(b) || 'Driver';
    const url =
      src?.profile_photo_url || src?.profile_photo || src?.avatar_url || src?.photo_url || src?.image_url || null;
    if (url && String(url).startsWith('http')) return url;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B2E2B&color=fff&size=128`;
  };
  const getDriverRating = (b) => {
    const raw = b?.assigned_driver?.average_rating ?? b?.assigned_driver?.rating ?? b?.driver?.average_rating ??
                b?.driver?.rating ?? b?.driver_rating ?? b?.assigned_driver_rating ?? null;
    const r = Number(raw);
    return Number.isFinite(r) && r > 0 ? Math.min(5, r) : null;
  };
  const getDriverContact = (b) => {
    const contacts = [
      b?.assigned_driver?.email,
      b?.driver?.email,
      b?.assigned_driver?.phone,
      b?.driver?.phone,
      b?.driver_email,
      b?.driver_phone
    ];
    
    return contacts.find(contact => contact && String(contact).trim()) || null;
  };

  const hasAssignedDriver = (b) => {
    const driverId = getDriverId(b);
    const driverName = getDriverName(b);
    const driverContact = getDriverContact(b);
    return !!(driverId || driverName || driverContact);
  };

  const getDriverId = (b) => {
    return b?.driver_id || 
           b?.assigned_driver_id || 
           b?.driver?.id || 
           b?.assigned_driver?.id ||
           b?.driver_info?.id ||
           b?.driver_details?.id ||
           null;
  };
  const getPackageId = (b) => b?.package_id || b?.package?.id || b?.tour_package_id || null;

  // Check if booking can be cancelled
  const canCancelBooking = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    const paymentStatus = (booking?.payment_status || '').toLowerCase();
    // Can cancel if not in progress or completed, and if paid, only before trip starts
    return (status === 'pending' || status === 'confirmed' || status === 'driver_assigned' || status === 'waiting_for_driver' || status === 'no_driver_available') && 
           (paymentStatus !== 'paid' || status === 'driver_assigned');
  };

  // Check if booking timed out (no driver available)
  const isBookingTimedOut = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    return status === 'no_driver_available';
  };

  // Check if booking can be rebooked
  const canRebookBooking = (booking) => {
    return isBookingTimedOut(booking);
  };

  // Handle rebooking for timed out bookings
  const handleRebookBooking = (booking) => {
    Alert.alert(
      'Rebook Your Tour',
      'No driver was available for your original date. Would you like to select a new date?',
      [
        { text: 'Cancel Booking', style: 'destructive', onPress: () => handleCancelTimeoutBooking(booking) },
        { text: 'Select New Date', onPress: () => navigation.navigate('RebookTour', { 
          bookingId: booking.id,
          originalBooking: booking,
          onRebookSuccess: () => fetchUserAndBookings()
        })}
      ]
    );
  };

  // Handle cancelling a timed out booking
  const handleCancelTimeoutBooking = async (booking) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || apiBaseUrl().replace('/api', '')}/api/bookings/cancel-timeout/${booking.id}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: user?.id,
          reason: 'No driver available - cancelled by customer'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        Alert.alert(
          'Booking Cancelled',
          'Your booking has been cancelled. If you made a payment, a full refund will be processed.',
          [{ text: 'OK', onPress: () => fetchUserAndBookings() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to cancel booking');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
    }
  };

  // Check if booking can be paid for (driver assigned but not paid)
  const canPayForBooking = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    const paymentStatus = (booking?.payment_status || '').toLowerCase();
    return status === 'driver_assigned' && (paymentStatus === 'pending' || paymentStatus === '' || !paymentStatus);
  };

  // Check if booking is paid and waiting for trip to start
  const isPaidAndWaitingForTrip = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    const paymentStatus = (booking?.payment_status || '').toLowerCase();
    return paymentStatus === 'paid' && status === 'driver_assigned';
  };

  // Check if booking is in progress or completed
  const isTripStartedOrCompleted = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    return status === 'in_progress' || status === 'completed';
  };

  // Handle payment for confirmed booking
  const handlePayForBooking = (booking) => {
    const packageName = getPackageName(booking);
    const totalAmount = getTotalAmount(booking);
    const bookingDate = getBookingDateValue(booking);
    const numPax = getNumPax(booking);
    
    navigation.navigate('Payment', {
      bookingId: booking.id,
      bookingData: {
        packageName: packageName,
        bookingDate: formatDate(bookingDate),
        numberOfPax: numPax,
      },
      packageData: {
        packageName: packageName,
        bookingDate: formatDate(bookingDate),
        numberOfPax: numPax,
      },
      amount: totalAmount,
      currency: 'PHP',
    });
  };

  const buildStars = (rating) => {
    if (rating == null) return null;
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <View style={styles.ratingRow}>
        {Array.from({ length: full }).map((_, i) => <Ionicons key={`f${i}`} name="star" size={14} />)}
        {half ? <Ionicons name="star-half" size={14} /> : null}
        {Array.from({ length: empty }).map((_, i) => <Ionicons key={`e${i}`} name="star-outline" size={14} />)}
        <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
      </View>
    );
  };

  // ---------- reusable row
  const Row = ({ icon, label, value, valueStyle }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={16} color="#9aa0a6" />
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, valueStyle]} numberOfLines={2} ellipsizeMode="tail">
        {String(value ?? '')}
      </Text>
    </View>
  );

  // ---------- verification & reviews helpers
  const loadVerificationFor = async (booking) => {
    try {
      const res = await getVerificationStatus(booking.id, user?.id);
      if (res?.network_error) {
        setVerificationMap((prev) => ({
          ...prev,
          [String(booking.id)]: { checked: true, available: false, url: null, network_error: true },
        }));
        return;
      }
      const available = !!(res?.data?.verification_available);
      const url = res?.data?.verification_photo_url || null;
      setVerificationMap((prev) => ({
        ...prev,
        [String(booking.id)]: { checked: true, available, url },
      }));
    } catch (e) {
      setVerificationMap((prev) => ({
        ...prev,
        [String(booking.id)]: { checked: true, available: false, url: null },
      }));
    }
  };

  const loadExistingReviews = async (booking) => {
    if (!user?.id || !booking?.id) return;
    try {
      const res = await checkExistingReviews({ 
        booking_id: booking.id, 
        reviewer_id: user.id 
      });
      if (res.success) {
        setRatedMap((prev) => ({
          ...prev,
          [String(booking.id)]: {
            package: res.data.hasPackageReview,
            driver: res.data.hasDriverReview
          }
        }));
      }
    } catch (e) {
      // Handle missing reviews table gracefully
      if (e?.code === '42P01' || e?.message?.includes('does not exist')) {
        console.log('Reviews table not available');
      }
    }
  };

  const openRating = (booking, type) => {
    setRatingValue(0);
    setRatingComment('');
    setRatingModal({ visible: true, type, booking });
  };

  const submitRating = async () => {
    const bk = ratingModal.booking;
    if (!bk || !user) return;
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      Alert.alert('Select rating', 'Please select a rating from 1 to 5 stars.');
      return;
    }
    try {
      let res;
      if (ratingModal.type === 'package') {
        const packageId = getPackageId(bk);
        if (!packageId) {
          Alert.alert('Error', 'Missing package ID for this booking.');
          return;
        }
        res = await createPackageReview({
          package_id: packageId,
          booking_id: bk.id,
          reviewer_id: user.id,
          rating: ratingValue,
          comment: ratingComment,
        });
      } else {
        const driverId = getDriverId(bk);
        if (!driverId) {
          Alert.alert('Error', 'No driver assigned to this booking.');
          return;
        }
        res = await createDriverReview({
          driver_id: driverId,
          booking_id: bk.id,
          reviewer_id: user.id,
          rating: ratingValue,
          comment: ratingComment,
        });
      }

      if (res.success) {
        setRatedMap((prev) => ({
          ...prev,
          [String(bk.id)]: {
            ...(prev[String(bk.id)] || {}),
            [ratingModal.type]: true,
          },
        }));
        Alert.alert('Thank you!', 'Your review has been submitted.');
        setRatingModal({ visible: false, type: 'package', booking: null });
      } else {
        const msg = res.error || 'Failed to submit review';
        if (/already exists|already reviewed/i.test(msg)) {
          setRatedMap((prev) => ({
            ...prev,
            [String(bk.id)]: {
              ...(prev[String(bk.id)] || {}),
              [ratingModal.type]: true,
            },
          }));
          setRatingModal({ visible: false, type: 'package', booking: null });
          Alert.alert('Already Reviewed', `You have already submitted a review for this ${ratingModal.type === 'package' ? 'package' : 'driver'}.`);
        } else {
          Alert.alert('Error', msg);
        }
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to submit review');
    }
  };

  // ======= Cancellation handlers (reworked UX) =======
  const handleCancelBooking = async (booking) => {
    if (!booking || !user) return;
    // Open modal immediately with loading state
    setCancelReason('');
    setAckCancel(false);
    setCancelModal({ visible: true, booking, policy: null, loading: true, error: null });

    try {
      const policyResult = await getCancellationPolicy(booking.id, user.id);
      if (policyResult.success) {
        setCancelModal((prev) => ({ ...prev, policy: policyResult.data, loading: false }));
      } else {
        // graceful fallback to local policy
        const totalAmount = getTotalAmount(booking) || 0;
        const bookingDate = getBookingDateValue(booking);
        if (totalAmount && bookingDate) {
          const localPolicy = calculateCancellationFee(bookingDate, totalAmount);
          setCancelModal((prev) => ({ ...prev, policy: localPolicy, loading: false, error: null }));
        } else {
          setCancelModal((prev) => ({ ...prev, loading: false, error: 'Unable to fetch policy.' }));
        }
      }
    } catch {
      const totalAmount = getTotalAmount(booking) || 0;
      const bookingDate = getBookingDateValue(booking);
      if (totalAmount && bookingDate) {
        const localPolicy = calculateCancellationFee(bookingDate, totalAmount);
        setCancelModal((prev) => ({ ...prev, policy: localPolicy, loading: false, error: null }));
      } else {
        setCancelModal((prev) => ({ ...prev, loading: false, error: 'Unable to fetch policy.' }));
      }
    }
  };

  const confirmCancelBooking = async () => {
    if (!cancelModal.booking || !user) return;
    try {
      setCancelling(true);
      const result = await cancelBooking(
        cancelModal.booking.id, 
        user.id, 
        cancelReason
      );
      if (result.success) {
        invalidateData.bookings(); // Trigger auto-refresh across all screens
        setCancelModal({ visible: false, booking: null, policy: null, loading: false, error: null });
        const refundAmount = result.refund_info?.refund_amount || cancelModal.policy?.refund_amount || 0;
        const processingTime = result.refund_info?.processing_time || '3-5 business days';
        Alert.alert(
          'Booking Cancelled',
          `Your booking has been cancelled successfully.${refundAmount > 0 ? `\n\nRefund of ₱${refundAmount.toFixed(2)} will be processed within ${processingTime}.` : ''}`,
          [{ text: 'OK', onPress: () => fetchUserAndBookings() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to cancel booking');
      }
    } catch {
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const StarPicker = ({ value, onChange }) => (
    <View style={styles.starSelectRow}>
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        const active = value >= idx;
        return (
          <TouchableOpacity key={idx} onPress={() => onChange(idx)}>
            <Ionicons name={active ? 'star' : 'star-outline'} size={28} color={active ? '#F5A623' : '#999'} />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ---------- booking card (SIMPLE HEADER/META, keeping all sections)
  const renderBookingCard = (b) => {
    const pkgName   = getPackageName(b);
    const date      = getBookingDateValue(b);
    const time      = getPickupTimeValue(b);
    const pax       = getNumPax(b);
    const addr      = getPickupAddress(b);
    const contact   = getContactNumber(b);
    const total     = getTotalAmount(b);
    const ref       = getBookingReference(b);

    const driverName = getDriverName(b);
    const avatarUrl  = getDriverAvatarUrl(b);
    const rating     = getDriverRating(b);

    const expandId = String(ref || b.id || 'unknown');
    const isExpanded = !!expandedMap[expandId];
    const statusColor = getStatusColor(b);

    const toggleExpand = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedMap((p) => ({ ...p, [expandId]: !p[expandId] }));
      try {
        if (!isExpanded && b?.id) {
          if (!verificationMap[String(b.id)]) loadVerificationFor(b);
          if (String((b.status || '')).toLowerCase() === 'completed' && !ratedMap[String(b.id)]) {
            loadExistingReviews(b);
          }
        }
      } catch {}
    };
    const pkgDetails = getPackageDetails(b);

    return (
      <View key={b.id || ref} style={styles.card}>
        {/* Simple top section */}
        <TouchableOpacity onPress={toggleExpand} activeOpacity={0.9}>
          <View style={styles.simpleTopRow}>
            <Text style={styles.simpleTitle} numberOfLines={1} ellipsizeMode="tail">
              {pkgName || 'Package'}
            </Text>
            <View style={[styles.simpleBadge, { borderColor: statusColor }]}>
              <Ionicons name={getStatusIcon(b)} size={14} color={statusColor} />
              <Text style={[styles.simpleBadgeText, { color: statusColor }]} numberOfLines={1}>
                {prettyStatus(b)}
              </Text>
            </View>
          </View>

          <Text style={styles.simpleMeta} numberOfLines={1}>
            {formatDate(date)} • {formatTime(time)}
            {pax != null ? ` • ${pax} pax` : ''}
          </Text>

          <View style={styles.simpleMidRow}>
            <View style={styles.simpleDriverRow}>
              {hasAssignedDriver(b) ? (
                <>
                  <Image source={{ uri: avatarUrl }} style={styles.simpleAvatar} />
                  <View style={{ minWidth: 0 }}>
                    <Text style={styles.simpleDriverName} numberOfLines={1}>
                      {driverName || getDriverContact(b) || 'Driver Assigned'}
                    </Text>
                    {buildStars(rating)}
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="person-outline" size={18} color="#9aa0a6" />
                  <Text style={styles.simpleDriverName}>No driver yet</Text>
                </>
              )}
            </View>
            <Text style={styles.simpleTotal}>{formatCurrency(total)}</Text>
          </View>
        </TouchableOpacity>

        {/* Details (unchanged content) */}
        {isExpanded && (
          <View style={styles.details}>
            <View style={styles.simpleSep} />
            <Row icon="people-outline" label="Passengers" value={pax ?? 'N/A'} />
            <Row icon="location-outline" label="Pickup Address" value={addr || 'N/A'} />
            <Row icon="call-outline" label="Contact" value={contact || 'N/A'} />

            {(pkgDetails.durationHours || pkgDetails.maxPax || pkgDetails.pickupLocation || pkgDetails.destination || pkgDetails.route) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Package</Text>
                {pkgDetails.durationHours ? <Row icon="time-outline" label="Duration" value={`${pkgDetails.durationHours} hours`} /> : null}
                {pkgDetails.maxPax ? <Row icon="people-outline" label="Max Pax" value={pkgDetails.maxPax} /> : null}
                {pkgDetails.pickupLocation ? <Row icon="navigate-outline" label="Pickup" value={pkgDetails.pickupLocation} /> : null}
                {pkgDetails.destination ? <Row icon="flag-outline" label="Destination" value={pkgDetails.destination} /> : null}
                {pkgDetails.route ? <Row icon="map-outline" label="Route" value={pkgDetails.route} /> : null}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Driver</Text>
              <View style={styles.driverBlock}>
                <Image source={{ uri: avatarUrl }} style={styles.driverAvatarLg} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.driverName} numberOfLines={1} ellipsizeMode="middle">
                    {driverName || 'To be assigned'}
                  </Text>
                  {getDriverContact(b) && (
                    <Text style={styles.driverContact} numberOfLines={1}>
                      {getDriverContact(b)}
                    </Text>
                  )}
                  {buildStars(rating)}
                </View>
              </View>
            </View>
            {/* Divider */}
            <View style={styles.dottedDivider} />

            {(canCancelBooking(b) || canPayForBooking(b) || isPaidAndWaitingForTrip(b) || isTripStartedOrCompleted(b) || canRebookBooking(b)) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Actions</Text>
                <View style={styles.actionRow}>
                  {canPayForBooking(b) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.payBtn]}
                      onPress={() => handlePayForBooking(b)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="card-outline" size={16} color="#2E7D32" />
                      <Text style={[styles.actionBtnText, { color: '#2E7D32' }]} numberOfLines={1}>Pay Now</Text>
                    </TouchableOpacity>
                  )}
                  {isPaidAndWaitingForTrip(b) && (
                    <View style={[styles.actionBtn, { backgroundColor: '#E8F5E8', borderColor: '#C8E6C9' }]}>
                      <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                      <Text style={[styles.actionBtnText, { color: '#2E7D32' }]} numberOfLines={1}>Payment Complete</Text>
                    </View>
                  )}
                  {isTripStartedOrCompleted(b) && (
                    <View style={[styles.actionBtn, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}>
                      <Ionicons name="car" size={16} color="#1976D2" />
                      <Text style={[styles.actionBtnText, { color: '#1976D2' }]} numberOfLines={1}>
                        {(b?.status || '').toLowerCase() === 'completed' ? 'Trip Completed' : 'Trip In Progress'}
                      </Text>
                    </View>
                  )}
                  {canRebookBooking(b) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}
                      onPress={() => handleRebookBooking(b)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#FF9800" />
                      <Text style={[styles.actionBtnText, { color: '#FF9800' }]} numberOfLines={1}>Rebook Tour</Text>
                    </TouchableOpacity>
                  )}
                  {canCancelBooking(b) && !canRebookBooking(b) && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.cancelBtn]}
                      onPress={() => handleCancelBooking(b)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#C62828" />
                      <Text style={[styles.actionBtnText, { color: '#C62828' }]} numberOfLines={1}>Cancel Booking</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {isPaidAndWaitingForTrip(b) && (
                  <Text style={styles.smallNote}>✅ Payment received! Your driver can now start the trip on the scheduled date.</Text>
                )}
                {isTripStartedOrCompleted(b) && (b?.status || '').toLowerCase() === 'in_progress' && (
                  <Text style={styles.smallNote}>🚗 Your trip is currently in progress. Enjoy your tour!</Text>
                )}
                {isBookingTimedOut(b) && (
                  <Text style={styles.smallNote}>⏰ No driver accepted within 6 hours. Please rebook for another date or cancel for a full refund.</Text>
                )}
              </View>
            )}

            {String((b.status || '')).toLowerCase() === 'completed' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>After Trip</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, (ratedMap[String(b.id)]?.package) && styles.actionBtnDisabled]}
                    onPress={() => openRating(b, 'package')}
                    disabled={!!ratedMap[String(b.id)]?.package}
                    activeOpacity={0.85}
                  >
                    <Ionicons 
                      name={ratedMap[String(b.id)]?.package ? "checkmark-circle" : "star-outline"} 
                      size={16} 
                      color={ratedMap[String(b.id)]?.package ? "#2E7D32" : MAROON} 
                    />
                    <Text style={[styles.actionBtnText, ratedMap[String(b.id)]?.package && { color: '#2E7D32' }]} numberOfLines={1}>
                      {ratedMap[String(b.id)]?.package ? 'Package Rated' : 'Rate Package'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, (!getDriverId(b) || ratedMap[String(b.id)]?.driver) && styles.actionBtnDisabled]}
                    onPress={() => openRating(b, 'driver')}
                    disabled={!getDriverId(b) || !!ratedMap[String(b.id)]?.driver}
                    activeOpacity={0.85}
                  >
                    <Ionicons 
                      name={ratedMap[String(b.id)]?.driver ? "checkmark-circle" : "person-outline"} 
                      size={16} 
                      color={ratedMap[String(b.id)]?.driver ? "#2E7D32" : MAROON} 
                    />
                    <Text style={[styles.actionBtnText, ratedMap[String(b.id)]?.driver && { color: '#2E7D32' }]} numberOfLines={1}>
                      {ratedMap[String(b.id)]?.driver ? 'Driver Rated' : 'Rate Driver'}
                    </Text>
                  </TouchableOpacity>

                  {verificationMap[String(b.id)]?.available && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setViewer({ visible: true, url: verificationMap[String(b.id)]?.url })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="image-outline" size={16} color={MAROON} />
                      <Text style={styles.actionBtnText} numberOfLines={1}>View Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {verificationMap[String(b.id)]?.checked && !verificationMap[String(b.id)]?.available ? (
                  <Text style={styles.smallNote}>No verification photo uploaded for this booking.</Text>
                ) : null}
              </View>
            )}
            {/* for tour bookings */}
            {/* Add communication section */}
            {(b.status === 'driver_assigned' || 
              b.status === 'accepted' || 
              b.status === 'in_progress' || 
              b.status === 'ongoing') && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Communication</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}
                    onPress={async () => {
                      // Get driver profile first
                      const driverId = getDriverId(b);
                      const driver = await getDriverProfile(driverId);
                      
                      navigation.navigate('Communication', { 
                        screen: 'ChatRoom',
                        params: { 
                          bookingId: b.id,
                          subject: `Tour: ${b.package_name || 'Package'}`,
                          participantRole: 'driver',
                          requestType: 'package_booking',
                          userRole: 'tourist',
                          contactName: driver?.name || cleanName(getDriverName(b)) || 'Driver',
                          contactEmail: driver?.email || getDriverContact(b)
                        }
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#1976D2" />
                    <Text style={[styles.actionBtnText, { color: '#1976D2' }]} numberOfLines={1}>
                      Message Driver
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.refText}>Ref: {ref || 'N/A'}</Text>
          </View>
        )}
      </View>
    );
  };

  // ---------- custom request helpers (unchanged)
  const getCustomTitle   = (r) => (r?.request_type === 'special_event'
    ? (r?.event_type || 'Special Event')
    : (r?.destination || r?.route ? `Custom Tour: ${r.destination || r.route}` : 'Custom Tour'));
  const getCustomDate    = (r) => r?.preferred_date || r?.event_date || null;
  const getCustomTime    = (r) => r?.event_time || null;
  const getCustomPax     = (r) => r?.number_of_pax ?? r?.pax ?? null;
  const getCustomPickupAddress = (r) => r?.pickup_location || r?.event_address || null;
  const getCustomStatus  = (r) => r?.status || 'pending';
  const getCustomDriverName = (r) => r?.driver_name || r?.accepted_driver_name || r?.assigned_driver?.name || null;
  const hasAssignedDriverForCustom = (r) => !!(getCustomDriverName(r) && String(getCustomDriverName(r)).trim());
  const getCustomOwnerName = (r) => r?.owner_name || r?.event_owner?.name || r?.owner?.name || null;
  
  // Utility to clean up email-like names
  const cleanName = (name) => {
    if (!name) return null;
    let trimmed = String(name).trim();
    // If it's an email, keep only the part before "@"
    if (trimmed.includes('@')) {
      trimmed = trimmed.split('@')[0];
    }
    return trimmed;
  };
  const getCustomContactName = (r) => {
    let name;

    if (r.request_type === 'special_event') {
      name = getCustomOwnerName(r) || 'Event Owner';
    } else {
      name = getCustomDriverName(r) || 'Driver';
    }
    return cleanName(name);
  };

  // ---------- custom request card (apply simple header/meta, keep details)
  const renderCustomRequestCard = (r) => {
    const title  = getCustomTitle(r);
    const date   = getCustomDate(r);
    const time   = getCustomTime(r);
    const pax    = getCustomPax(r);
    const addr   = getCustomPickupAddress(r);
    const status = getCustomStatus(r);
    const driver = getCustomDriverName(r);

    const expandId = `custom-${r?.id}`;
    const isExpanded = !!expandedMap[expandId];
    const toggleExpand = () => setExpandedMap((p) => ({ ...p, [expandId]: !p[expandId] }));
    const getCustomParticipantRole = (r) => {
      // Use request_type to determine role
      if (r.request_type === 'special_event') {
        return 'owner';
      }
      return 'driver';
    };

    // For custom tours: show when driver_assigned or in_progress
    // For special events: show when owner_accepted or in_progress
    const shouldShowMessageButton = (
      // For custom tours with an assigned driver
      (r.request_type !== 'special_event' && 
        hasAssignedDriverForCustom(r) && 
        (status.toLowerCase() === 'driver_assigned' || 
          status.toLowerCase() === 'in_progress')) 
      ||
      // For special events with owner acceptance
      (r.request_type === 'special_event' && 
        (status.toLowerCase() === 'owner_accepted' || 
          status.toLowerCase() === 'in_progress'))
    );

    return (
      <View key={expandId} style={styles.card}>
        <TouchableOpacity onPress={toggleExpand} activeOpacity={0.9}>
          {/* Simple header/meta */}
          <View style={styles.simpleTopRow}>
            <Text style={styles.simpleTitle} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            <View style={[styles.simpleBadge, { borderColor: getStatusColor({ status }) }]}>
              <Ionicons name={getStatusIcon({ status })} size={14} color={getStatusColor({ status })} />
              <Text style={[styles.simpleBadgeText, { color: getStatusColor({ status }) }]} numberOfLines={1}>
                {prettyStatus({ status })}
              </Text>
            </View>
          </View>

          <Text style={styles.simpleMeta} numberOfLines={1}>
            {formatDate(date)}{time ? ` • ${formatTime(time)}` : ''}{pax != null ? ` • ${pax} pax` : ''}
          </Text>

          {/* Mini driver line */}
          <View style={styles.simpleMidRow}>
            <View style={styles.simpleDriverRow}>
              {hasAssignedDriverForCustom(r) ? (
                <>
                  <Ionicons name="person-circle-outline" size={20} color="#1a73e8" />
                  <Text style={[styles.simpleDriverName, { color: '#1a73e8' }]} numberOfLines={1}>{driver}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-outline" size={18} color="#9aa0a6" />
                  <Text style={styles.simpleDriverName}>No driver yet</Text>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.details}>
            <View style={styles.simpleSep} />
            <Row icon="people-outline" label="Passengers" value={pax ?? 'N/A'} />
            <Row icon="location-outline" label="Pickup Address" value={addr || 'N/A'} />
            {!!r?.special_requests && (
              <Row icon="chatbubble-ellipses-outline" label="Special Requests" value={r.special_requests} />
            )}
            {shouldShowMessageButton && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Communication</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}
                    onPress={async () => {
                      // Correctly determine participant role based on request type
                      const participantRole = r.request_type === 'special_event' ? 'owner' : 'driver';
                      
                      // Correctly determine request type based on request_type field
                      const requestType = r.request_type === 'special_event' 
                        ? 'special_event_request' 
                        : 'custom_tour_package';
                      
                      // Get the right IDs based on request type
                      let packageId = null;
                      let eventId = null;
                      let contactId = null;
                      
                      if (r.request_type === 'special_event') {
                        // For special events, use special_event_request_id
                        eventId = r.special_event_request_id || null;
                        contactId = r.owner_id || null;
                      } else {
                        // For custom tours, use custom_tour_package_id
                        packageId = r.custom_tour_package_id || null;
                        contactId = r.driver_id || null;
                      }
                      
                      try {
                        // Get contact person profile
                        const contact = contactId ? await getDriverProfile(contactId) : null;
                        
                        navigation.navigate('Communication', { 
                          screen: 'ChatRoom',
                          params: { 
                            bookingId: r.id,
                            subject: r.request_type === 'special_event'
                              ? `Special Event: ${getCustomTitle(r)}`
                              : `Custom Tour: ${getCustomTitle(r).replace(/^Custom Tour:\s*/, '')}`,
                            participantRole: participantRole,
                            requestType: requestType,
                            packageId: packageId || null,
                            eventId: eventId || null,
                            contactName: contact?.name || cleanName(getCustomContactName(r)) || (r.request_type === 'special_event' ? 'Event Owner' : 'Driver'),
                            contactEmail: contact?.email
                          }
                        });
                      } catch (error) {
                        console.error('Error getting contact person info:', error);
                        // Fallback if profile lookup fails
                        navigation.navigate('Communication', { 
                          screen: 'ChatRoom',
                          params: { 
                            bookingId: r.id,
                            subject: r.request_type === 'special_event'
                              ? `Special Event: ${getCustomTitle(r)}`
                              : `Custom Tour: ${getCustomTitle(r).replace(/^Custom Tour:\s*/, '')}`,
                            participantRole: participantRole,
                            requestType: requestType,
                            packageId: packageId || null,
                            eventId: eventId || null,
                            contactName: cleanName(getCustomContactName(r)) || (r.request_type === 'special_event' ? 'Event Owner' : 'Driver')
                          }
                        });
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#1976D2" />
                    <Text style={[styles.actionBtnText, { color: '#1976D2' }]} numberOfLines={1}>
                      Message 
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <Text style={styles.refText}>Req ID: {r?.id}</Text>
          </View>
        )}
      </View>
    );
  };

  // Add this function after the cleanName function:
  const getDriverProfile = async (driverId) => {
    if (!driverId || driverId === 'undefined') {
      console.warn('No valid driverId provided');
      return { id: null, name: 'Driver' };
    }

    const { data, error } = await supabase
      .from('public_user_profiles')
      .select('id, name')
      .eq('id', driverId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching driver profile:', error);
      return { id: driverId, name: 'Driver' };
    }
    return data || { id: driverId, name: 'Driver' };
  };

  // ---------- derived lists / counts (single filter path)
  const filterMatches = (item) => {
    const status = (item?.status || '').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') return status === 'pending' || status === 'confirmed';
    if (activeFilter === 'completed') return status === 'completed';
    if (activeFilter === 'cancelled') return status === 'cancelled';
    if (activeFilter === 'pending') return status === 'pending';
    if (activeFilter === 'confirmed') return status === 'confirmed';
    return true;
  };

  // Search removed: use only filterMatches
  const filteredBookings = bookings.filter((b) => filterMatches(b));
  const filteredCustom   = customRequests.filter((r) => filterMatches(r));

  const statusCounts = (() => {
    const allItems = bookings; // counts are for tour bookings only (as before)
    const counts = { all: allItems.length, upcoming: 0, confirmed: 0, pending: 0, completed: 0, cancelled: 0 };
    for (const b of allItems) {
      const s = (b.status || '').toLowerCase();
      if (s === 'pending' || s === 'confirmed') counts.upcoming += 1;
      if (counts[s] !== undefined) counts[s] += 1;
    }
    return counts;
  })();

  const FILTERS = [
    { key: 'all', label: 'All', icon: 'grid-outline' },
    { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
    { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
    { key: 'pending', label: 'Pending', icon: 'time-outline' },
    { key: 'completed', label: 'Completed', icon: 'checkmark-done-circle-outline' },
    { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
  ];

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="bicycle-outline" size={40} color="#c7b7a3" />
      <Text style={styles.emptyTitle}>No bookings yet</Text>
      <Text style={styles.emptySub}>
        When you book a tour or create a custom request, it will show up here.
      </Text>
      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.ctaText}>Explore Packages</Text>
      </TouchableOpacity>
    </View>
  );

  // ---------- render
  return (
    <View style={styles.container}>
      {/* Search bar removed */}

      <View style={styles.content}>
        {/* Title + actions */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>My Bookings</Text>
          {(user?.role === 'tourist' || (!user?.role && user)) && (
            <TouchableOpacity
              style={styles.customRequestBtn}
              onPress={() => navigation.navigate('CustomRequestHistory')}
              activeOpacity={0.85}
            >
              <Ionicons name="construct" size={16} color={MAROON} />
              <Text style={styles.customRequestBtnText}>Custom Requests</Text>
              <Ionicons name="chevron-forward" size={16} color={MAROON} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <Text style={styles.filtersLabel}>Filters</Text>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterPicker(true)} activeOpacity={0.85}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={FILTERS.find((f) => f.key === activeFilter)?.icon || 'filter'} size={16} color={MAROON} />
              <Text style={styles.filterBtnLabel} numberOfLines={1}>
                {FILTERS.find((f) => f.key === activeFilter)?.label || 'Filter'}
              </Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{statusCounts[activeFilter] ?? 0}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Filter modal */}
        <Modal visible={showFilterPicker} transparent animationType="fade" onRequestClose={() => setShowFilterPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Filter</Text>
                <TouchableOpacity onPress={() => setShowFilterPicker(false)}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {FILTERS.map((f) => {
                  const active = activeFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.modalOption, active && styles.modalOptionActive]}
                      onPress={() => { setActiveFilter(f.key); setShowFilterPicker(false); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name={f.icon} size={16} color={active ? MAROON : '#666'} />
                        <Text style={[styles.modalOptionText, active && { color: MAROON, fontWeight: '700' }]}
                        >
                          {f.label}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.smallPill, active && styles.smallPillActive]}>
                          <Text style={[styles.smallPillText, active && styles.smallPillTextActive]}>
                            {statusCounts[f.key] ?? 0}
                          </Text>
                        </View>
                        {active ? <Ionicons name="checkmark-circle" size={18} color={MAROON} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Rating modal */}
        <Modal
          visible={ratingModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setRatingModal({ visible: false, type: 'package', booking: null })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {ratingModal.type === 'package' ? 'Rate Package' : 'Rate Driver'}
                </Text>
                <TouchableOpacity onPress={() => setRatingModal({ visible: false, type: 'package', booking: null })}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                <StarPicker value={ratingValue} onChange={setRatingValue} />
                <Text style={{ marginTop: 8, fontSize: 12, color: '#777' }}>Optional comment</Text>
                <TextInput
                  style={styles.modalTextarea}
                  placeholder="Share your experience"
                  placeholderTextColor="#999"
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={[styles.pillBtn, { backgroundColor: '#444', flex: 1 }]} onPress={() => setRatingModal({ visible: false, type: 'package', booking: null })}>
                    <Text style={styles.pillBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pillBtn, { flex: 1 }]} onPress={submitRating}>
                    <Text style={styles.pillBtnText}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* ======= Cancellation modal (reworked) ======= */}
        <Modal
          visible={cancelModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => !cancelling && setCancelModal({ visible: false, booking: null, policy: null, loading: false, error: null })}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { borderRadius: 16 }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.warnIconWrap}>
                  <Ionicons name="warning-outline" size={18} color="#C62828" />
                </View>
                <Text style={styles.modalTitle}>Cancel Booking</Text>
                <TouchableOpacity 
                  onPress={() => !cancelling && setCancelModal({ visible: false, booking: null, policy: null, loading: false, error: null })}
                  disabled={cancelling}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 16 }}>
                {/* Booking summary */}
                {cancelModal.booking && (
                  <View style={styles.bookingSummary}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.bookingSummaryText} numberOfLines={2}>
                      {getPackageName(cancelModal.booking) || 'Package'} • {formatDate(getBookingDateValue(cancelModal.booking))} {getPickupTimeValue(cancelModal.booking) ? `• ${formatTime(getPickupTimeValue(cancelModal.booking))}` : ''} • Ref: {getBookingReference(cancelModal.booking) || 'N/A'}
                    </Text>
                  </View>
                )}

                {/* Policy loader / card / error */}
                {cancelModal.loading ? (
                  <View style={styles.policyLoading}>
                    <ActivityIndicator color={MAROON} />
                    <Text style={styles.policyLoadingText}>Checking cancellation policy…</Text>
                  </View>
                ) : cancelModal.error ? (
                  <View style={[styles.policyCard, { backgroundColor: '#FFF1F2', borderColor: '#FECACA' }]}>
                    <Text style={[styles.policyTitle, { color: '#B91C1C' }]}>Policy Unavailable</Text>
                    <Text style={[styles.policyMessage, { color: '#7F1D1D' }]}>
                      {cancelModal.error} Try again later, or proceed — fees (if any) will be shown on the next screen.
                    </Text>
                  </View>
                ) : cancelModal.policy ? (
                  <View style={styles.policyCard}>
                    <Text style={styles.policyTitle}>Cancellation Policy</Text>
                    {!!cancelModal.policy.policy_message && (
                      <Text style={styles.policyMessage}>{cancelModal.policy.policy_message}</Text>
                    )}
                    <View style={styles.policyDetails}>
                      <View style={styles.policyRow}>
                        <Text style={styles.policyLabel}>Original Amount</Text>
                        <Text style={styles.policyValue}>₱{(cancelModal.policy.total_amount || 0).toFixed(2)}</Text>
                      </View>

                      {Number(cancelModal.policy.cancellation_fee) > 0 && (
                        <View style={styles.policyRow}>
                          <Text style={styles.policyLabel}>Cancellation Fee</Text>
                          <Text style={[styles.policyValue, { color: '#C62828' }]}>-₱{(cancelModal.policy.cancellation_fee || 0).toFixed(2)}</Text>
                        </View>
                      )}

                      <View style={[styles.policyRow, styles.policyRowTotal]}>
                        <Text style={styles.policyLabelTotal}>Refund Amount</Text>
                        <Text style={styles.policyValueTotal}>₱{(cancelModal.policy.refund_amount || 0).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Quick reasons */}
                <Text style={styles.reasonLabel}>Reason (optional)</Text>
                <View style={styles.chipsRow}>
                  {QUICK_REASONS.map((r) => {
                    const active = cancelReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setCancelReason(active ? '' : r)}
                        style={[styles.chip, active && styles.chipActive]}
                        activeOpacity={0.85}
                        disabled={cancelling}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.modalTextarea}
                  placeholder="Add more details (optional)…"
                  placeholderTextColor="#999"
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  editable={!cancelling}
                />

                {/* Acknowledge */}
                <TouchableOpacity
                  style={styles.ackRow}
                  onPress={() => !cancelling && setAckCancel((v) => !v)}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={ackCancel ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={ackCancel ? MAROON : '#9AA0A6'}
                  />
                  <Text style={styles.ackText}>
                    I understand this will cancel my booking and any applicable fees will be applied.
                  </Text>
                </TouchableOpacity>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity 
                    style={[styles.pillBtn, { backgroundColor: '#666', flex: 1 }]} 
                    onPress={() => setCancelModal({ visible: false, booking: null, policy: null, loading: false, error: null })}
                    disabled={cancelling}
                  >
                    <Text style={styles.pillBtnText}>Keep Booking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.pillBtn, 
                      { backgroundColor: '#C62828', flex: 1, opacity: ackCancel && !cancelling ? 1 : 0.6 }
                    ]} 
                    onPress={confirmCancelBooking}
                    disabled={!ackCancel || cancelling}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.pillBtnText}>{cancelling ? 'Cancelling…' : 'Cancel Booking'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Verification viewer */}
        <Modal
          visible={viewer.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setViewer({ visible: false, url: null })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Verification Photo</Text>
                <TouchableOpacity onPress={() => setViewer({ visible: false, url: null })}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                {viewer.url ? (
                  <Image source={{ uri: viewer.url }} style={styles.viewerImage} />
                ) : (
                  <Text style={{ color: '#666' }}>No photo available</Text>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Lists */}
        {loading ? (
          <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading your bookings...</Text></View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {filteredBookings.length === 0 && filteredCustom.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {filteredBookings.length > 0 && (
                  <>
                    <Text style={styles.sectionCaption}>Tour Bookings</Text>
                    {filteredBookings.map(renderBookingCard)}
                  </>
                )}

                {filteredCustom.length > 0 && (
                  <>
                    <Text style={styles.sectionCaption}>Custom Requests</Text>
                    {filteredCustom.map(renderCustomRequestCard)}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 16 },

  // top header
  header: { 
    paddingVertical: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  pageTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#222', 
  },

  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },

  customRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: MAROON,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  customRequestBtnText: {
    color: MAROON,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // legacy pillBtn kept for other places (modals, etc.)
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: MAROON, paddingHorizontal: 21, paddingVertical: 8, borderRadius: 999 },
  pillBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // filters
  filtersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
  filtersLabel: { fontSize: 12, letterSpacing: 0.6, color: '#999', fontWeight: '700', textTransform: 'uppercase' },
  filterBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minWidth: 140 },
  filterBtnLabel: { color: '#333', fontWeight: '700' },
  countPill: { backgroundColor: '#F5E9E2', borderColor: '#E0CFC2', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { color: MAROON, fontWeight: '700', fontSize: 12 },

  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, width: '90%', maxWidth: 440, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  warnIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 8 },

  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f6f6f6' },
  modalOptionActive: { backgroundColor: '#F9F2EE' },
  modalOptionText: { color: '#333', fontSize: 14 },
  smallPill: { backgroundColor: '#f0f0f0', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  smallPillActive: { backgroundColor: '#EED7CD' },
  smallPillText: { fontSize: 10, fontWeight: '700', color: '#666' },
  smallPillTextActive: { color: MAROON },

  // modal forms
  modalTextarea: { marginTop: 8, minHeight: 84, borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 10, color: '#333', backgroundColor: '#FAFAFA' },
  starSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  viewerImage: { width: '100%', height: 320, borderRadius: 10, resizeMode: 'cover', backgroundColor: '#eee' },

  // sections
  sectionCaption: { marginTop: 8, marginBottom: 6, color: '#999', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 999 },
  actionBtnText: { color: MAROON, fontSize: 12, fontWeight: '700' },
  actionBtnDisabled: { opacity: 0.5 },
  cancelBtn: { borderColor: '#FFCDD2' },
  payBtn: { borderColor: '#C8E6C9' },
  smallNote: { fontSize: 12, color: '#9aa0a6', marginTop: 6 },

  // cancellation policy styles
  bookingSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#F9FAFB', marginBottom: 10 },
  bookingSummaryText: { flex: 1, color: '#374151', fontSize: 12, lineHeight: 16 },

  policyLoading: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  policyLoadingText: { marginTop: 8, color: '#6B7280', fontSize: 12 },

  policyCard: { backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFEDD5' },
  policyTitle: { fontSize: 14, fontWeight: '800', color: '#9A3412', marginBottom: 6 },
  policyMessage: { fontSize: 12, color: '#7C2D12', marginBottom: 10, lineHeight: 18 },
  policyDetails: { gap: 6 },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  policyRowTotal: { borderTopWidth: 1, borderTopColor: '#FFEDD5', paddingTop: 8, marginTop: 4 },
  policyLabel: { fontSize: 13, color: '#6B7280' },
  policyValue: { fontSize: 13, color: '#111827', fontWeight: '700' },
  policyLabelTotal: { fontSize: 14, color: '#111827', fontWeight: '900' },
  policyValueTotal: { fontSize: 14, color: '#065F46', fontWeight: '900' },

  reasonLabel: { fontSize: 12, color: '#6B7280', marginTop: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#9D174D' },

  ackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  ackText: { flex: 1, fontSize: 12, color: '#374151' },

  // ===== SIMPLE, MODERN CARD LOOK =====
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // simple header + meta
  simpleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  simpleTitle: { fontSize: 16, fontWeight: '700', color: '#222', flex: 1 },

  simpleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  simpleBadgeText: { fontSize: 12, fontWeight: '700' },

  simpleMeta: { marginTop: 6, fontSize: 12, color: '#666' },

  // driver + total compact row
  simpleMidRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  simpleDriverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  simpleAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  simpleDriverName: { fontSize: 13, color: '#333', fontWeight: '700' },
  simpleTotal: { fontSize: 15, color: '#2E7D32', fontWeight: '800' },

  simpleSep: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },

  // details (kept)
  details: { marginTop: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, width: 140 },
  rowLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  rowValue: { flex: 1, fontSize: 14, color: '#333', textAlign: 'right', minWidth: 0 },

  section: { marginTop: 6, gap: 8 },
  sectionLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  driverBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatarLg: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  driverName: { fontSize: 14, color: '#333', fontWeight: '700' },
  driverContact: { fontSize: 12, color: '#666', marginTop: 2 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  ratingText: { fontSize: 12, color: '#666', marginLeft: 6, fontWeight: '600' },

  refText: { marginTop: 8, fontSize: 12, color: '#9aa0a6', textAlign: 'right' },

  // empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  cta: { backgroundColor: MAROON, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  dottedDivider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    borderBottomColor: '#9190901d',
    borderBottomWidth: 1,
    borderStyle: 'SOLID',
  },
});

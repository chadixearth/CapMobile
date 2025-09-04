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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { getCustomerBookings } from '../../services/tourpackage/requestBooking';
import { getCurrentUser } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { getCustomerCustomRequests } from '../../services/specialpackage/customPackageRequest';
import { createPackageReview, createDriverReview } from '../../services/reviews';
import { getVerificationStatus } from '../../services/tourpackage/bookingVerification';
import { getCancellationPolicy, cancelBooking, calculateCancellationFee } from '../../services/tourpackage/bookingCancellation';

const MAROON = '#6B2E2B';

export default function BookScreen({ navigation }) {
  const auth = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  // filters & search
  const [activeFilter, setActiveFilter] = useState('all'); // all | upcoming | completed | cancelled | pending | confirmed
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // cancellation state
  const [cancelModal, setCancelModal] = useState({ visible: false, booking: null, policy: null });
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

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
  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'confirmed': return '#2e7d32';
      case 'pending':   return '#ef6c00';
      case 'cancelled': return '#c62828';
      case 'completed': return '#1565c0';
      default:          return '#616161';
    }
  };
  const getStatusIcon = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'confirmed': return 'checkmark-circle';
      case 'pending':   return 'time';
      case 'cancelled': return 'close-circle';
      case 'completed': return 'checkmark-done-circle';
      default:          return 'help-circle';
    }
  };
  const prettyStatus = (s) =>
    (s || 'Unknown').toString().toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

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
    const n = b?.assigned_driver?.name || b?.driver?.name || b?.assigned_driver_name || b?.driver_name || null;
    if (n && /@/.test(String(n))) return null;
    return n && String(n).trim() ? n : null;
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
  const hasAssignedDriver = (b) => !!getDriverName(b);

  const getDriverId = (b) => b?.driver_id || b?.assigned_driver_id || b?.driver?.id || b?.assigned_driver?.id || null;
  const getPackageId = (b) => b?.package_id || b?.package?.id || b?.tour_package_id || null;

  // Check if booking can be cancelled
  const canCancelBooking = (booking) => {
    const status = (booking?.status || '').toLowerCase();
    return status === 'pending' || status === 'confirmed' || status === 'driver_assigned' || status === 'waiting_for_driver';
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
        Alert.alert('Error', msg);
        if (/already exists|already reviewed/i.test(msg)) {
          setRatedMap((prev) => ({
            ...prev,
            [String(bk.id)]: {
              ...(prev[String(bk.id)] || {}),
              [ratingModal.type]: true,
            },
          }));
          setRatingModal({ visible: false, type: 'package', booking: null });
        }
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to submit review');
    }
  };

  // Cancellation handlers
  const handleCancelBooking = async (booking) => {
    if (!booking || !user) return;
    
    try {
      // Check cancellation policy first
      const policyResult = await getCancellationPolicy(booking.id, user.id);
      
      if (policyResult.success) {
        setCancelModal({ 
          visible: true, 
          booking: booking, 
          policy: policyResult.data 
        });
        setCancelReason('');
      } else {
        // Fallback to local calculation if API fails
        const totalAmount = getTotalAmount(booking) || 0;
        const bookingDate = getBookingDateValue(booking);
        
        if (totalAmount && bookingDate) {
          const localPolicy = calculateCancellationFee(bookingDate, totalAmount);
          setCancelModal({ 
            visible: true, 
            booking: booking, 
            policy: localPolicy 
          });
          setCancelReason('');
        } else {
          Alert.alert('Error', 'Unable to check cancellation policy. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error checking cancellation policy:', error);
      Alert.alert('Error', 'Failed to check cancellation policy.');
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
        setCancelModal({ visible: false, booking: null, policy: null });
        
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
    } catch (error) {
      console.error('Error cancelling booking:', error);
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

  // ---------- booking card
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
    const toggleExpand = () => {
      setExpandedMap((p) => ({ ...p, [expandId]: !p[expandId] }));
      try {
        if (!isExpanded && String((b.status || '')).toLowerCase() === 'completed' && b?.id && !verificationMap[String(b.id)]) {
          loadVerificationFor(b);
        }
      } catch {}
    };
    const pkgDetails = getPackageDetails(b);

    return (
      <View key={b.id || ref} style={styles.card}>
        {/* Header */}
        <TouchableOpacity onPress={toggleExpand} activeOpacity={0.85}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">
                {pkgName || 'Package'}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <View style={[styles.statusPill, { backgroundColor: `${getStatusColor(b.status)}1A` }]}>
                <Ionicons name={getStatusIcon(b.status)} size={14} color={getStatusColor(b.status)} />
                <Text
                  style={[styles.statusPillText, { color: getStatusColor(b.status) }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {prettyStatus(b.status)}
                </Text>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color="#8a8a8a"
              />
            </View>
          </View>

          {/* Sub header: date/time on left, driver chip on right */}
          <View style={styles.subHeader}>
            <Text style={styles.subMeta} numberOfLines={1}>
              {formatDate(date)} • {formatTime(time)}
            </Text>

            {hasAssignedDriver(b) && (
              <View style={styles.driverChip}>
                <Image source={{ uri: avatarUrl }} style={styles.driverChipAvatar} />
                <Text style={styles.driverChipText} numberOfLines={1} ellipsizeMode="middle">
                  {driverName}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Details */}
        {isExpanded && (
          <View style={styles.details}>
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
                    {driverName || 'Not set yet'}
                  </Text>
                  {buildStars(rating)}
                </View>
              </View>
            </View>

            <Row
              icon="wallet-outline"
              label="Total"
              value={formatCurrency(total)}
              valueStyle={{ fontWeight: '700', color: '#2E7D32' }}
            />

            {canCancelBooking(b) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Actions</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn]}
                    onPress={() => handleCancelBooking(b)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#C62828" />
                    <Text style={[styles.actionBtnText, { color: '#C62828' }]} numberOfLines={1}>Cancel Booking</Text>
                  </TouchableOpacity>
                </View>
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
                    <Ionicons name="star-outline" size={16} color={MAROON} />
                    <Text style={styles.actionBtnText} numberOfLines={1}>Rate Package</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, (!getDriverId(b) || ratedMap[String(b.id)]?.driver) && styles.actionBtnDisabled]}
                    onPress={() => openRating(b, 'driver')}
                    disabled={!getDriverId(b) || !!ratedMap[String(b.id)]?.driver}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="person-outline" size={16} color={MAROON} />
                    <Text style={styles.actionBtnText} numberOfLines={1}>Rate Driver</Text>
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

            <Text style={styles.refText}>Ref: {ref || 'N/A'}</Text>
          </View>
        )}
      </View>
    );
  };

  // ---------- custom request helpers (re-using same layout)
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

  // ---------- custom request card (same design as booking)
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

    return (
      <View key={expandId} style={styles.card}>
        <TouchableOpacity onPress={toggleExpand} activeOpacity={0.85}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.titleText} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <View style={[styles.statusPill, { backgroundColor: `${getStatusColor(status)}1A` }]}>
                <Ionicons name={getStatusIcon(status)} size={14} color={getStatusColor(status)} />
                <Text style={[styles.statusPillText, { color: getStatusColor(status) }]} numberOfLines={1}>
                  {prettyStatus(status)}
                </Text>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color="#8a8a8a"
              />
            </View>
          </View>

          {/* Sub header row: type badge on left, driver chip on right (like bookings) */}
          <View style={styles.subHeader}>
            <View style={styles.typePill}>
              <Ionicons
                name={r?.request_type === 'special_event' ? 'calendar' : 'construct'}
                size={12}
                color={MAROON}
              />
              <Text style={styles.typePillText} numberOfLines={1}>
                {r?.request_type === 'special_event' ? 'Special Event' : 'Custom Tour'}
              </Text>
            </View>

            <Text style={[styles.subMeta, { marginLeft: 8 }]} numberOfLines={1}>
              {formatDate(date)}{time ? ` • ${formatTime(time)}` : ''}
            </Text>

            {hasAssignedDriverForCustom(r) && (
              <View style={styles.driverChip}>
                <Ionicons name="person" size={14} color="#1a73e8" />
                <Text style={styles.driverChipText} numberOfLines={1} ellipsizeMode="middle">
                  {driver}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.details}>
            <Row icon="people-outline" label="Passengers" value={pax ?? 'N/A'} />
            <Row icon="location-outline" label="Pickup Address" value={addr || 'N/A'} />
            {!!r?.special_requests && (
              <Row icon="chatbubble-ellipses-outline" label="Special Requests" value={r.special_requests} />
            )}
            <Text style={styles.refText}>Req ID: {r?.id}</Text>
          </View>
        )}
      </View>
    );
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

  const searchMatches = (b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const composite = [
      b?.booking_reference, b?.package_name, b?.tour_package_name, b?.packageTitle, b?.name,
      b?.id, b?.request_type, b?.destination, b?.event_type, b?.status
    ].filter(Boolean).join(' ').toLowerCase();
    return composite.includes(q);
  };

  const filteredBookings = bookings.filter((b) => filterMatches(b) && searchMatches(b));
  const filteredCustom   = customRequests.filter((r) => filterMatches(r) && searchMatches(r));

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
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#fff" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by reference or package"
          placeholderTextColor="#fff"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

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

        {/* Cancellation modal */}
        <Modal
          visible={cancelModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => !cancelling && setCancelModal({ visible: false, booking: null, policy: null })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cancel Booking</Text>
                <TouchableOpacity 
                  onPress={() => !cancelling && setCancelModal({ visible: false, booking: null, policy: null })}
                  disabled={cancelling}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                {cancelModal.policy && (
                  <View style={styles.policyCard}>
                    <Text style={styles.policyTitle}>Cancellation Policy</Text>
                    <Text style={styles.policyMessage}>{cancelModal.policy.policy_message}</Text>
                    
                    <View style={styles.policyDetails}>
                      <View style={styles.policyRow}>
                        <Text style={styles.policyLabel}>Original Amount:</Text>
                        <Text style={styles.policyValue}>₱{(cancelModal.policy.total_amount || 0).toFixed(2)}</Text>
                      </View>
                      
                      {cancelModal.policy.cancellation_fee > 0 && (
                        <View style={styles.policyRow}>
                          <Text style={styles.policyLabel}>Cancellation Fee:</Text>
                          <Text style={[styles.policyValue, { color: '#C62828' }]}>-₱{(cancelModal.policy.cancellation_fee || 0).toFixed(2)}</Text>
                        </View>
                      )}
                      
                      <View style={[styles.policyRow, styles.policyRowTotal]}>
                        <Text style={styles.policyLabelTotal}>Refund Amount:</Text>
                        <Text style={styles.policyValueTotal}>₱{(cancelModal.policy.refund_amount || 0).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                )}
                
                <Text style={styles.reasonLabel}>Reason for cancellation (optional):</Text>
                <TextInput
                  style={styles.modalTextarea}
                  placeholder="Please let us know why you're cancelling..."
                  placeholderTextColor="#999"
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  editable={!cancelling}
                />
                
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity 
                    style={[styles.pillBtn, { backgroundColor: '#666', flex: 1 }]} 
                    onPress={() => setCancelModal({ visible: false, booking: null, policy: null })}
                    disabled={cancelling}
                  >
                    <Text style={styles.pillBtnText}>Keep Booking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pillBtn, { backgroundColor: '#C62828', flex: 1 }]} 
                    onPress={confirmCancelBooking}
                    disabled={cancelling}
                  >
                    <Text style={styles.pillBtnText}>{cancelling ? 'Cancelling...' : 'Cancel Booking'}</Text>
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

  // search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAROON,
    borderRadius: 18,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 36,
    marginTop: 18,
  },
  searchInput: { flex: 1, color: '#fff', marginLeft: 6, fontSize: 13 },

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
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: MAROON, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  pillBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // filters
  filtersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
  filtersLabel: { fontSize: 12, letterSpacing: 0.6, color: '#999', fontWeight: '700', textTransform: 'uppercase' },
  filterBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minWidth: 140 },
  filterBtnLabel: { color: '#333', fontWeight: '700' },
  countPill: { backgroundColor: '#F5E9E2', borderColor: '#E0CFC2', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countPillText: { color: MAROON, fontWeight: '700', fontSize: 12 },

  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, width: '90%', maxWidth: 420, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f6f6f6' },
  modalOptionActive: { backgroundColor: '#F9F2EE' },
  modalOptionText: { color: '#333', fontSize: 14 },
  smallPill: { backgroundColor: '#f0f0f0', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  smallPillActive: { backgroundColor: '#EED7CD' },
  smallPillText: { fontSize: 10, fontWeight: '700', color: '#666' },
  smallPillTextActive: { color: MAROON },

  // modal forms
  modalTextarea: { marginTop: 8, minHeight: 80, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, color: '#333' },
  starSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  viewerImage: { width: '100%', height: 320, borderRadius: 10, resizeMode: 'cover', backgroundColor: '#eee' },

  // sections
  sectionCaption: { marginTop: 8, marginBottom: 6, color: '#999', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 999 },
  actionBtnText: { color: MAROON, fontSize: 12, fontWeight: '700' },
  actionBtnDisabled: { opacity: 0.5 },
  cancelBtn: { borderColor: '#FFCDD2' },
  smallNote: { fontSize: 12, color: '#9aa0a6', marginTop: 6 },

  // cancellation policy styles
  policyCard: { backgroundColor: '#FFF3E0', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FFE0B2' },
  policyTitle: { fontSize: 14, fontWeight: '700', color: '#E65100', marginBottom: 8 },
  policyMessage: { fontSize: 13, color: '#BF360C', marginBottom: 12, lineHeight: 18 },
  policyDetails: { gap: 6 },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  policyRowTotal: { borderTopWidth: 1, borderTopColor: '#FFE0B2', paddingTop: 8, marginTop: 4 },
  policyLabel: { fontSize: 13, color: '#666' },
  policyValue: { fontSize: 13, color: '#333', fontWeight: '600' },
  policyLabelTotal: { fontSize: 14, color: '#333', fontWeight: '700' },
  policyValueTotal: { fontSize: 14, color: '#2E7D32', fontWeight: '700' },
  reasonLabel: { fontSize: 13, color: '#333', marginBottom: 8, fontWeight: '600' },

  // card
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // card header & subheader
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },

  titleText: { fontSize: 16, fontWeight: '700', color: '#222', flexShrink: 1 },
  subHeader: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subMeta: { fontSize: 12, color: '#666', flex: 1, minWidth: 0 },

  // pills / chips
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: 160 },
  statusPillText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },

  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F5E9E2', borderColor: '#E0CFC2', borderWidth: 1, borderRadius: 999, alignSelf: 'flex-start' },
  typePillText: { fontSize: 10, color: MAROON, fontWeight: '700' },

  driverChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#E3F2FD', borderColor: '#BBDEFB', borderWidth: 1, borderRadius: 999, maxWidth: 200 },
  driverChipAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  driverChipText: { fontSize: 12, color: '#1a73e8', fontWeight: '700', maxWidth: 164 },

  // details
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
});

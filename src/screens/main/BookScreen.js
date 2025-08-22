import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { getCustomerBookings } from '../../services/tourpackage/requestBooking';
import { getCurrentUser } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import { getCustomerCustomRequests } from '../../services/specialpackage/customPackageRequest';

const MAROON = '#6B2E2B';

export default function BookScreen({ navigation }) {
  // All hooks must be called at the top level, before any conditional returns
  const auth = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all | upcoming | completed | cancelled | pending | confirmed
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMap, setExpandedMap] = useState({}); // id -> boolean for dropdown
  const [customRequests, setCustomRequests] = useState([]);

  // Handle authentication redirect in useEffect to avoid hooks rule violation
  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) {
      fetchUserAndBookings();
    }
  }, [auth.loading, auth.isAuthenticated]);

  // Show loading while auth is being determined
  if (auth.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Return null while redirecting (but after all hooks have been called)
  if (!auth.isAuthenticated) {
    return null;
  }

  const fetchUserAndBookings = async () => {
    try {
      setLoading(true);
      
      // Check new auth system first
      let currentUser = await getCurrentUser();
      let userId = null;
      
      if (currentUser) {
        // User is logged in via new auth system
        console.log('Current user (new auth):', currentUser);
        setUser(currentUser);
        userId = currentUser.id;
      } else {
        // Fallback to Supabase for existing users
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          Alert.alert('Error', 'Please log in to view your bookings');
          return;
        }

        console.log('Current user (Supabase):', user);
        setUser(user);
        userId = user.id;
      }

      // Fetch user's bookings
      console.log('Fetching bookings for user ID:', userId);
      const bookingsData = await getCustomerBookings(userId);
      console.log('Bookings data received:', bookingsData);
      
      // Handle different response formats
      let processedBookings = [];
      if (Array.isArray(bookingsData)) {
        processedBookings = bookingsData;
      } else if (bookingsData && Array.isArray(bookingsData.results)) {
        processedBookings = bookingsData.results;
      } else if (bookingsData && Array.isArray(bookingsData.data)) {
        processedBookings = bookingsData.data;
      } else if (bookingsData && bookingsData.bookings) {
        processedBookings = bookingsData.bookings;
      } else if (bookingsData && bookingsData.data && Array.isArray(bookingsData.data.bookings)) {
        // Handle the nested structure: {data: {bookings: [...]}}
        processedBookings = bookingsData.data.bookings;
      } else if (bookingsData && bookingsData.success && bookingsData.data && Array.isArray(bookingsData.data.bookings)) {
        // Handle the structure: {success: true, data: {bookings: [...]}}
        processedBookings = bookingsData.data.bookings;
      } else {
        console.log('Unexpected bookings data format:', bookingsData);
        processedBookings = [];
      }
      
      console.log('Processed bookings:', processedBookings);
      if (processedBookings.length > 0) {
        console.log('First booking sample:', processedBookings[0]);
      }
      setBookings(processedBookings);

      // Fetch user's custom requests (custom tours + special events)
      try {
        const customRes = await getCustomerCustomRequests(userId);
        if (customRes && customRes.success) {
          setCustomRequests(Array.isArray(customRes.data) ? customRes.data : []);
        } else {
          setCustomRequests([]);
        }
      } catch (e) {
        console.warn('Failed to load custom requests:', e?.message || e);
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'cancelled':
        return 'close-circle';
      case 'completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return timeString;
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  // Safe getters for inconsistent backend shapes
  const getPackageName = (booking) => (
    booking?.package_name ||
    booking?.package?.package_name ||
    booking?.package?.name ||
    booking?.tour_package_name ||
    booking?.packageTitle ||
    booking?.name ||
    null
  );

  // Additional safe getters for package details
  const getPackageDetails = (booking) => {
    const pkg = booking?.package || booking?.tour_package || null;
    const durationHours = booking?.duration_hours ?? pkg?.duration_hours ?? pkg?.duration ?? null;
    const maxPax = booking?.max_pax ?? pkg?.max_pax ?? pkg?.capacity ?? null;
    const pickupLocation = booking?.pickup_location ?? pkg?.pickup_location ?? null;
    const destination = booking?.destination ?? pkg?.destination ?? null;
    const route = booking?.route ?? pkg?.route ?? null;
    const availableDays = booking?.available_days ?? pkg?.available_days ?? null;
    const description = booking?.package_description ?? pkg?.description ?? null;
    return { durationHours, maxPax, pickupLocation, destination, route, availableDays, description };
  };

  const getBookingDateValue = (booking) => (
    booking?.booking_date || booking?.date || booking?.preferred_date || booking?.event_date || null
  );

  const getPickupTimeValue = (booking) => (
    booking?.pickup_time || booking?.time || booking?.event_time || null
  );

  const getNumPax = (booking) => (
    booking?.number_of_pax ?? booking?.num_pax ?? booking?.pax ?? booking?.passengers ?? null
  );

  const getPickupAddress = (booking) => (
    booking?.pickup_address || booking?.pickup_location || booking?.address || booking?.event_address || null
  );

  const getContactNumber = (booking) => (
    booking?.contact_number || booking?.contact || booking?.phone || booking?.customer_phone || null
  );

  const getTotalAmount = (booking) => (
    booking?.total_amount ?? booking?.approved_price ?? booking?.total_price ?? booking?.price ?? null
  );

  const getBookingReference = (booking) => (
    booking?.booking_reference || booking?.reference || booking?.ref || booking?.id || null
  );

  // Safely extract assigned driver info from various possible backend shapes
  const getDriverName = (booking) => {
    const candidate = (
      booking?.assigned_driver?.name ||
      booking?.driver?.name ||
      booking?.assigned_driver_name ||
      booking?.driver_name ||
      null
    );
    // Hide emails; show Not set yet instead
    if (candidate && /@/.test(String(candidate))) return null;
    return candidate && String(candidate).trim().length > 0 ? candidate : null;
  };

  const getDriverAvatarUrl = (booking) => {
    const source = booking?.assigned_driver || booking?.driver || null;
    const name = getDriverName(booking) || 'Driver';
    const url =
      source?.profile_photo_url ||
      source?.profile_photo ||
      source?.avatar_url ||
      source?.photo_url ||
      source?.image_url ||
      null;
    if (url && typeof url === 'string' && url.startsWith('http')) return url;
    // Fallback to generated avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B2E2B&color=fff&size=128`;
  };

  const getDriverRating = (booking) => {
    const raw =
      booking?.assigned_driver?.average_rating ??
      booking?.assigned_driver?.rating ??
      booking?.driver?.average_rating ??
      booking?.driver?.rating ??
      booking?.driver_rating ??
      booking?.assigned_driver_rating ??
      null;
    const rating = Number(raw);
    if (Number.isFinite(rating) && rating > 0) {
      return Math.min(5, rating);
    }
    return null;
  };

  const hasAssignedDriver = (booking) => {
    const name = getDriverName(booking);
    if (name && String(name).trim().length > 0) return true;
    return false;
  };

  // ===== Custom Requests helpers =====
  const getCustomTitle = (req) => {
    if (req?.request_type === 'special_event') {
      return req?.event_type || 'Special Event';
    }
    const dest = req?.destination || req?.route || '';
    return dest ? `Custom Tour: ${dest}` : 'Custom Tour';
  };

  const getCustomDate = (req) => (
    req?.preferred_date || req?.event_date || null
  );

  const getCustomTime = (req) => (
    req?.event_time || null
  );

  const getCustomPax = (req) => (
    req?.number_of_pax ?? req?.pax ?? null
  );

  const getCustomPickupAddress = (req) => (
    req?.pickup_location || req?.event_address || null
  );

  const getCustomStatus = (req) => (
    req?.status || 'pending'
  );

  const getCustomDriverName = (req) => (
    req?.driver_name || req?.accepted_driver_name || req?.assigned_driver?.name || null
  );

  const hasAssignedDriverForCustom = (req) => {
    const name = getCustomDriverName(req);
    return !!(name && String(name).trim().length > 0);
  };

  const buildStars = (rating) => {
    if (rating === null || rating === undefined) return null;
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;
    const empty = 5 - full - (hasHalf ? 1 : 0);
    return (
      <View style={styles.ratingRow}>
        {Array.from({ length: full }).map((_, i) => (
          <Ionicons key={`full-${i}`} name="star" size={14} color="#F5A623" />
        ))}
        {hasHalf ? <Ionicons name="star-half" size={14} color="#F5A623" /> : null}
        {Array.from({ length: empty }).map((_, i) => (
          <Ionicons key={`empty-${i}`} name="star-outline" size={14} color="#F5A623" />
        ))}
        <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
      </View>
    );
  };

  const renderBookingCard = (booking) => {
    const driverName = getDriverName(booking);
    const avatarUrl = getDriverAvatarUrl(booking);
    const rating = getDriverRating(booking);
    const pkgName = getPackageName(booking);
    const bookingDate = getBookingDateValue(booking);
    const pickupTime = getPickupTimeValue(booking);
    const pax = getNumPax(booking);
    const addr = getPickupAddress(booking);
    const contact = getContactNumber(booking);
    const amount = getTotalAmount(booking);
    const ref = getBookingReference(booking);
    const expandId = String(ref || booking.id || 'unknown');
    const isExpanded = !!expandedMap[expandId];
    const toggleExpand = () => setExpandedMap((prev) => ({ ...prev, [expandId]: !prev[expandId] }));
    const pkgDetails = getPackageDetails(booking);
    return (
    <View key={booking.id || ref} style={styles.bookingCard}>
      <TouchableOpacity style={styles.bookingHeader} onPress={toggleExpand} activeOpacity={0.8}>
        <View style={styles.bookingInfo}>
          <Text style={styles.cardTitle}>{pkgName || 'Package'}</Text>
          <Text style={styles.cardSubtitle}>
            {formatDate(bookingDate)} • {formatTime(pickupTime)}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(booking.status)}20` }]}> 
            <Ionicons name={getStatusIcon(booking.status)} size={16} color={getStatusColor(booking.status)} />
            <Text style={[styles.statusBadgeText, { color: getStatusColor(booking.status) }]}>
              {booking.status || 'Unknown'}
            </Text>
          </View>
          {hasAssignedDriver(booking) && (
            <View style={styles.driverBadge}>
              <Ionicons name="person" size={14} color="#1a73e8" />
              <Text style={styles.driverBadgeText} numberOfLines={1}>
                {getDriverName(booking)}
              </Text>
            </View>
          )}
          <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#888" />
        </View>
      </TouchableOpacity>

      {isExpanded && (
      <View style={styles.bookingDetails}>
        {/* Package section */}
        <View style={styles.detailRow}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="pricetag-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Package</Text>
          </View>
          <Text style={styles.detailValue}>{pkgName || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="calendar-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Date</Text>
          </View>
          <Text style={styles.detailValue}>{formatDate(bookingDate)}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="time-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Pickup Time</Text>
          </View>
          <Text style={styles.detailValue}>{formatTime(pickupTime)}</Text>
        </View>

        {/* Package details (if available) */}
        {(pkgDetails.durationHours || pkgDetails.maxPax || pkgDetails.pickupLocation || pkgDetails.destination || pkgDetails.route || (Array.isArray(pkgDetails.availableDays) && pkgDetails.availableDays.length > 0) || pkgDetails.description) && (
          <View style={styles.packageSection}>
            <Text style={styles.sectionLabel}>Package Details</Text>
            {pkgDetails.durationHours ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="time-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Duration</Text>
                </View>
                <Text style={styles.detailValue}>{pkgDetails.durationHours} hours</Text>
              </View>
            ) : null}
            {pkgDetails.maxPax ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="people-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Max Pax</Text>
                </View>
                <Text style={styles.detailValue}>{pkgDetails.maxPax}</Text>
              </View>
            ) : null}
            {pkgDetails.pickupLocation ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="navigate-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Pickup</Text>
                </View>
                <Text style={styles.detailValue}>{pkgDetails.pickupLocation}</Text>
              </View>
            ) : null}
            {pkgDetails.destination ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="flag-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Destination</Text>
                </View>
                <Text style={styles.detailValue}>{pkgDetails.destination}</Text>
              </View>
            ) : null}
            {pkgDetails.route ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="map-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Route</Text>
                </View>
                <Text style={styles.detailValue}>{pkgDetails.route}</Text>
              </View>
            ) : null}
            {Array.isArray(pkgDetails.availableDays) && pkgDetails.availableDays.length > 0 ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="calendar-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Available</Text>
                </View>
                <Text style={styles.detailValue}>{pkgDetails.availableDays.join(', ')}</Text>
              </View>
            ) : null}
            {pkgDetails.description ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="document-text-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Description</Text>
                </View>
                <Text style={[styles.detailValue, { textAlign: 'left' }]} numberOfLines={4}>
                  {pkgDetails.description}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Driver section (clean UI) */}
        <View style={styles.driverSection}>
          <Text style={styles.sectionLabel}>Driver</Text>
          <View style={styles.driverRow}>
            <Image source={{ uri: avatarUrl }} style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName || 'Not set yet'}</Text>
              {buildStars(rating)}
            </View>
          </View>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="people-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Passengers</Text>
          </View>
          <Text style={styles.detailValue}>{pax ?? 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="location-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Pickup Address</Text>
          </View>
          <Text style={styles.detailValue}>{addr || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="call-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Contact</Text>
          </View>
          <Text style={styles.detailValue}>{contact || 'N/A'}</Text>
        </View>

        {booking.special_requests && (
          <View style={styles.detailRow}>
            <View style={styles.detailLabelRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#999" />
              <Text style={styles.detailLabel}>Special Requests</Text>
            </View>
            <Text style={styles.detailValue}>{booking.special_requests}</Text>
          </View>
        )}

        <View style={[styles.detailRow, { marginTop: 4 }]}>
          <View style={styles.detailLabelRow}>
            <Ionicons name="wallet-outline" size={16} color="#999" />
            <Text style={styles.detailLabel}>Total</Text>
          </View>
          <Text style={[styles.detailValue, { fontWeight: '700', color: '#2E7D32' }]}>
            {formatCurrency(amount)}
          </Text>
        </View>

        <Text style={styles.refText}>Ref: {ref || 'N/A'}</Text>
      </View>
      )}
    </View>
    );
  };

  const renderCustomRequestCard = (req) => {
    const title = getCustomTitle(req);
    const date = getCustomDate(req);
    const time = getCustomTime(req);
    const pax = getCustomPax(req);
    const addr = getCustomPickupAddress(req);
    const status = getCustomStatus(req);
    const driver = getCustomDriverName(req);
    const ref = req?.id;
    const expandId = `custom-${ref}`;
    const isExpanded = !!expandedMap[expandId];
    const toggleExpand = () => setExpandedMap((prev) => ({ ...prev, [expandId]: !prev[expandId] }));

    return (
      <View key={expandId} style={styles.bookingCard}>
        <TouchableOpacity style={styles.bookingHeader} onPress={toggleExpand} activeOpacity={0.8}>
          <View style={styles.bookingInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.typeBadge}>
                <Ionicons name={req?.request_type === 'special_event' ? 'calendar' : 'construct'} size={12} color="#6B2E2B" />
                <Text style={styles.typeBadgeText}>{req?.request_type === 'special_event' ? 'Special Event' : 'Custom Tour'}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              {formatDate(date)}{time ? ` • ${formatTime(time)}` : ''}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(status)}20` }]}> 
              <Ionicons name={getStatusIcon(status)} size={16} color={getStatusColor(status)} />
              <Text style={[styles.statusBadgeText, { color: getStatusColor(status) }]}>
                {status || 'Unknown'}
              </Text>
            </View>
            {hasAssignedDriverForCustom(req) && (
              <View style={styles.driverBadge}>
                <Ionicons name="person" size={14} color="#1a73e8" />
                <Text style={styles.driverBadgeText} numberOfLines={1}>
                  {driver}
                </Text>
              </View>
            )}
            <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color="#888" />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailLabelRow}>
                <Ionicons name="people-outline" size={16} color="#999" />
                <Text style={styles.detailLabel}>Passengers</Text>
              </View>
              <Text style={styles.detailValue}>{pax ?? 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailLabelRow}>
                <Ionicons name="location-outline" size={16} color="#999" />
                <Text style={styles.detailLabel}>Pickup Address</Text>
              </View>
              <Text style={styles.detailValue}>{addr || 'N/A'}</Text>
            </View>

            {!!req?.special_requests && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#999" />
                  <Text style={styles.detailLabel}>Special Requests</Text>
                </View>
                <Text style={styles.detailValue}>{req.special_requests}</Text>
              </View>
            )}

            <Text style={styles.refText}>Req ID: {ref}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Bookings Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        You haven't made any bookings yet. Start exploring our tour packages!
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('TouristHome')}
      >
        <Text style={styles.exploreButtonText}>Explore Packages</Text>
      </TouchableOpacity>
    </View>
  );

  // Derived filtered list
  const filterMatches = (booking) => {
    const status = (booking.status || '').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') return status === 'pending' || status === 'confirmed';
    if (activeFilter === 'completed') return status === 'completed';
    if (activeFilter === 'cancelled') return status === 'cancelled';
    if (activeFilter === 'pending') return status === 'pending';
    if (activeFilter === 'confirmed') return status === 'confirmed';
    return true;
  };

  const searchMatches = (booking) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (booking.booking_reference || '').toLowerCase().includes(q) ||
      (booking.package_name || '').toLowerCase().includes(q)
    );
  };

  const filteredBookings = bookings.filter((b) => filterMatches(b) && searchMatches(b));

  // Merge custom requests into the list, labeled differently and searchable by simple key fields
  const filteredCustom = customRequests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const composite = [
      r.id,
      r.request_type,
      r.destination,
      r.event_type,
      r.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return composite.includes(q);
  });

  // Compute counts for filter chips (no hooks to avoid conditional hook issues)
  const statusCounts = (() => {
    const counts = { all: bookings.length, upcoming: 0, confirmed: 0, pending: 0, completed: 0, cancelled: 0 };
    for (const b of bookings) {
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

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'User'}'s booking history
          </Text>
          <View style={styles.headerActions}>
            {(user?.role === 'tourist' || (!user?.role && user)) && (
              <TouchableOpacity 
                style={styles.pillButton}
                onPress={() => navigation.navigate('CustomRequestHistory')}
              >
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.pillButtonText}>Custom Requests</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.pillButton, { backgroundColor: '#444' }]}
              onPress={() => fetchUserAndBookings()}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.pillButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by reference or package"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filterDropdownContainer}>
          <TouchableOpacity
            style={styles.filterDropdownButton}
            onPress={() => setShowFilterPicker(true)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={FILTERS.find(f => f.key === activeFilter)?.icon || 'filter'} size={16} color={MAROON} />
              <Text style={styles.filterDropdownLabel} numberOfLines={1}>
                {FILTERS.find(f => f.key === activeFilter)?.label || 'Filter'}
              </Text>
              <View style={styles.filterCountPill}>
                <Text style={styles.filterCountText}>{statusCounts[activeFilter] ?? 0}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Filter Picker Modal */}
        <Modal
          visible={showFilterPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFilterPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Filter</Text>
                <TouchableOpacity onPress={() => setShowFilterPicker(false)}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.modalOption, activeFilter === f.key && styles.modalOptionActive]}
                    onPress={() => { setActiveFilter(f.key); setShowFilterPicker(false); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={f.icon} size={16} color={activeFilter === f.key ? MAROON : '#666'} />
                      <Text style={[styles.modalOptionText, activeFilter === f.key && { color: MAROON, fontWeight: '700' }]}>
                        {f.label}
                      </Text>
                    </View>
                    <View style={[styles.countBadge, activeFilter === f.key && styles.countBadgeActive]}>
                      <Text style={[styles.countBadgeText, activeFilter === f.key && styles.countBadgeTextActive]}>
                        {statusCounts[f.key] ?? 0}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your bookings...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {filteredBookings.length === 0 && filteredCustom.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {/* Standard tour bookings */}
                {filteredBookings.length > 0 && (
                  <>
                    <Text style={styles.listSectionLabel}>Tour Bookings</Text>
                    {filteredBookings.map(renderBookingCard)}
                  </>
                )}

                {/* Custom requests */}
                {filteredCustom.length > 0 && (
                  <>
                    <Text style={styles.listSectionLabel}>Custom Requests</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingInfo: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  cardSubtitle: { fontSize: 12, color: '#777', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  bookingDetails: {
    gap: 8,
  },
  driverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderColor: '#BBDEFB',
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: 160,
  },
  driverBadgeText: {
    fontSize: 12,
    color: '#1a73e8',
    fontWeight: '700',
    maxWidth: 120,
  },
  packageSection: {
    marginTop: 6,
    marginBottom: 2,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  driverSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  exploreButton: {
    backgroundColor: MAROON,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    display: 'none',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#333',
  },
  filtersRow: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  filterDropdownContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterDropdownButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterDropdownLabel: { color: '#333', fontWeight: '700' },
  filterCountPill: {
    backgroundColor: '#F5E9E2',
    borderColor: '#E0CFC2',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  filterCountText: { color: MAROON, fontWeight: '700', fontSize: 12 },
  filterChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#F5E9E2',
    borderColor: '#E0CFC2',
  },
  filterChipText: { color: '#666', fontWeight: '700', fontSize: 12 },
  filterChipTextActive: {
    color: MAROON,
  },
  countBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeActive: {
    backgroundColor: '#EED7CD',
  },
  countBadgeText: { fontSize: 10, fontWeight: '700', color: '#666' },
  countBadgeTextActive: { color: MAROON },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refText: { marginTop: 10, fontSize: 12, color: '#999', textAlign: 'right' },
  listSectionLabel: {
    marginTop: 8,
    marginBottom: 6,
    color: '#999',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MAROON,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal base styles (reused)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 420,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f6f6',
  },
  modalOptionActive: { backgroundColor: '#F9F2EE' },
  modalOptionText: { color: '#333', fontSize: 14 },
});

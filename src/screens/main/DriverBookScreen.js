import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { supabase } from '../../services/supabase';
import {
  getAvailableBookingsForDrivers,
  driverAcceptBooking,
  getDriverBookings,
  updateBookingStatus,
} from '../../services/tourpackage/acceptBooking';
import {
  getAvailableRideBookings,
  acceptRideBooking,
  completeRideBooking,
  driverCancelRideBooking
} from '../../services/rideHailingService';
import { driverStartBooking, driverCancelBooking } from '../../services/tourpackage/acceptBooking';
import {
  completeBookingWithVerification,
} from '../../services/tourpackage/bookingVerification';
import { useScreenAutoRefresh, invalidateData } from '../../services/dataInvalidationService';
import VerificationPhotoModal from '../../components/VerificationPhotoModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import DriverCancellationModal from '../../components/DriverCancellationModal';
import LeafletMapView from '../../components/LeafletMapView';
import { fetchMapData } from '../../services/map/fetchMap';
import { apiBaseUrl } from '../../services/networkConfig';
import {
  getAvailableCustomTourRequestsForDrivers,
  driverAcceptCustomTourRequest,
  getDriverCustomTours,
  updateCustomTourStatus,
} from '../../services/specialpackage/customPackageRequest';
import { getCurrentUser } from '../../services/authService';
import NotificationService from '../../services/notificationService';
import NotificationManager from '../../components/NotificationManager';
import * as Routes from '../../constants/routes';

const RideMap = ({ ride }) => {
  const [mapData, setMapData] = useState(null);
  
  useEffect(() => {
    loadMapData();
  }, [ride]);
  
  const loadMapData = async () => {
    try {
      let pickupCoords = { latitude: 10.295, longitude: 123.89 };
      let dropoffCoords = { latitude: 10.305, longitude: 123.90 };
      
      // Parse actual coordinates from notes
      if (ride.notes) {
        const pickupMatch = ride.notes.match(/Pickup: ([\d.-]+), ([\d.-]+)/);
        const dropoffMatch = ride.notes.match(/Dropoff: ([\d.-]+), ([\d.-]+)/);
        
        if (pickupMatch) {
          pickupCoords = {
            latitude: parseFloat(pickupMatch[1]),
            longitude: parseFloat(pickupMatch[2])
          };
        }
        
        if (dropoffMatch) {
          dropoffCoords = {
            latitude: parseFloat(dropoffMatch[1]),
            longitude: parseFloat(dropoffMatch[2])
          };
        }
      }
      
      // Calculate region
      const centerLat = (pickupCoords.latitude + dropoffCoords.latitude) / 2;
      const centerLng = (pickupCoords.longitude + dropoffCoords.longitude) / 2;
      const deltaLat = Math.max(Math.abs(pickupCoords.latitude - dropoffCoords.latitude) * 1.5, 0.01);
      const deltaLng = Math.max(Math.abs(pickupCoords.longitude - dropoffCoords.longitude) * 1.5, 0.01);
      
      // Load only the specific route roads
      let roads = [];
      try {
        // Get route summaries and map data
        const [routeResponse, mapDataResult] = await Promise.all([
          fetch(`${apiBaseUrl()}/ride-hailing/route-summaries/`),
          fetchMapData({ cacheOnly: true })
        ]);
        
        if (routeResponse.ok && mapDataResult?.roads && mapDataResult?.points) {
          const routeData = await routeResponse.json();
          const routeSummaries = routeData.data || [];
          
          // Find pickup and dropoff points by coordinates
          const pickupPoint = mapDataResult.points.find(p => 
            Math.abs(parseFloat(p.latitude) - pickupCoords.latitude) < 0.001 &&
            Math.abs(parseFloat(p.longitude) - pickupCoords.longitude) < 0.001
          );
          
          const dropoffPoint = mapDataResult.points.find(p => 
            Math.abs(parseFloat(p.latitude) - dropoffCoords.latitude) < 0.001 &&
            Math.abs(parseFloat(p.longitude) - dropoffCoords.longitude) < 0.001
          );
          
          if (pickupPoint && dropoffPoint) {
            // Find the route that connects these specific points
            const matchingRoute = routeSummaries.find(r => {
              const pickupMatch = r.pickup_point_id == pickupPoint.id;
              
              let dropoffIds = r.dropoff_point_ids;
              if (typeof dropoffIds === 'string') {
                dropoffIds = dropoffIds.replace(/[{}]/g, '').split(',').map(id => parseInt(id.trim()));
              }
              
              const dropoffMatch = Array.isArray(dropoffIds) && dropoffIds.includes(parseInt(dropoffPoint.id));
              return pickupMatch && dropoffMatch;
            });
            
            if (matchingRoute) {
              // Get only roads for this specific route
              let roadIds = matchingRoute.road_highlight_ids;
              if (typeof roadIds === 'string') {
                roadIds = roadIds.replace(/[{}]/g, '').split(',').map(id => parseInt(id.trim()));
              }
              
              roads = mapDataResult.roads
                .filter(road => roadIds.includes(parseInt(road.id)))
                .map(road => ({
                  ...road,
                  color: matchingRoute.color || '#FF9800',
                  weight: 4,
                  opacity: 0.8
                }));
            }
          }
        }
      } catch (error) {
        console.log('Could not load specific route:', error);
      }
      
      setMapData({
        region: {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: deltaLat,
          longitudeDelta: deltaLng
        },
        markers: [
          {
            latitude: pickupCoords.latitude,
            longitude: pickupCoords.longitude,
            title: 'Pickup',
            description: ride.pickup_address,
            iconColor: '#2E7D32'
          },
          {
            latitude: dropoffCoords.latitude,
            longitude: dropoffCoords.longitude,
            title: 'Destination',
            description: ride.dropoff_address,
            iconColor: '#C62828'
          }
        ],
        roads
      });
    } catch (error) {
      console.error('Error loading map data:', error);
    }
  };
  
  if (!mapData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={{ marginTop: 8, color: '#666' }}>Loading map...</Text>
      </View>
    );
  }
  
  return (
    <LeafletMapView
      region={mapData.region}
      markers={mapData.markers}
      roads={mapData.roads}
      routes={[]}
      showSatellite={false}
    />
  );
};

export default function DriverBookScreen({ navigation }) {
  // Hide the default stack header (avoid double headers)
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [availableBookings, setAvailableBookings] = useState([]);
  const [availableCustomTours, setAvailableCustomTours] = useState([]);
  const [availableRideBookings, setAvailableRideBookings] = useState([]);
  const [driverBookings, setDriverBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [acceptingBooking, setAcceptingBooking] = useState(false);
  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'ongoing' | 'history'
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [bookingToVerify, setBookingToVerify] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [showDriverCancelModal, setShowDriverCancelModal] = useState(false);
  const [showRideMapModal, setShowRideMapModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState(null);

  // Animations for bottom-sheet modals
  const acceptAnim = useRef(new Animated.Value(0)).current;
  const completeAnim = useRef(new Animated.Value(0)).current;

  // Auto-refresh when data changes (debounced)
  useScreenAutoRefresh('DRIVER_BOOK', React.useCallback(() => {
    console.log('[DriverBookScreen] Auto-refreshing due to data changes');
    fetchUserAndBookings();
  }, []));

  useEffect(() => {
    fetchUserAndBookings();
    
    // Initialize notifications for drivers
    const initNotifications = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser && (currentUser.role === 'driver' || currentUser.role === 'driver-owner')) {
          // Start notification polling
          NotificationService.startPolling(currentUser.id, (newNotifications) => {
            console.log('Driver received new notifications:', newNotifications);
            
            // Refresh bookings when new notifications arrive
            if (newNotifications.length > 0) {
              fetchUserAndBookings();
              
              // Show alert for booking notifications
              const bookingNotifs = newNotifications.filter(n => n.type === 'booking');
              if (bookingNotifs.length > 0) {
                const latestNotif = bookingNotifs[0];
                
                // Check if it's a payment notification
                if (latestNotif.title?.includes('Payment Received')) {
                  // Force immediate refresh for payment notifications
                  setTimeout(() => fetchUserAndBookings(), 500);
                  
                  Alert.alert(
                    '💰 Payment Received!',
                    latestNotif.message,
                    [
                      { text: 'View Booking', onPress: () => setActiveTab('ongoing') },
                      { text: 'OK' }
                    ]
                  );
                } else {
                  Alert.alert(
                    '🚗 New Booking Available!',
                    latestNotif.message,
                    [
                      { text: 'Refresh', onPress: () => fetchUserAndBookings() },
                      { text: 'OK' }
                    ]
                  );
                }
              }
            }
          });
        }
      } catch (error) {
        console.error('Error initializing driver notifications:', error);
      }
    };
    
    initNotifications();
    
    return () => {
      NotificationService.stopPolling();
    };
  }, []);

  useEffect(() => {
    Animated.timing(acceptAnim, {
      toValue: showAcceptModal ? 1 : 0,
      duration: 220,
      easing: showAcceptModal ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showAcceptModal, acceptAnim]);

  useEffect(() => {
    Animated.timing(completeAnim, {
      toValue: showCompleteModal ? 1 : 0,
      duration: 220,
      easing: showCompleteModal ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showCompleteModal, completeAnim]);

  const fetchUserAndBookings = React.useCallback(async () => {
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
          Alert.alert('Error', 'Please log in to view bookings');
          setLoading(false);
          return;
        }
        setUser(user);
        userId = user.id;
      }

      // Fetch data sequentially with delays to avoid rate limiting
      try {
        await fetchAvailableBookings(userId);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await fetchAvailableCustomTours(userId);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await fetchAvailableRideBookings();
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await fetchDriverBookings(userId);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await fetchDriverCustomTours(userId);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      // Don't show alert for 500 errors, just set empty arrays
      if (error.message?.includes('500')) {
        setAvailableBookings([]);
        setDriverBookings([]);
      } else {
        Alert.alert('Error', `Failed to load bookings: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableBookings = async (driverId) => {
    try {
      const bookingsData = await getAvailableBookingsForDrivers(driverId);
      let processedBookings = [];
      if (bookingsData?.success && Array.isArray(bookingsData?.data?.bookings)) {
        processedBookings = bookingsData.data.bookings;
      } else if (Array.isArray(bookingsData)) {
        processedBookings = bookingsData;
      } else if (Array.isArray(bookingsData?.results)) {
        processedBookings = bookingsData.results;
      } else if (Array.isArray(bookingsData?.data)) {
        processedBookings = bookingsData.data;
      } else {
        processedBookings = [];
      }
      setAvailableBookings(processedBookings);
    } catch (error) {
      console.error('Error fetching available bookings:', error);
      setAvailableBookings([]);
    }
  };

  const fetchAvailableCustomTours = async (driverId) => {
    try {
      const customToursData = await getAvailableCustomTourRequestsForDrivers(driverId);
      if (customToursData?.success && Array.isArray(customToursData?.data)) {
        const filtered = (customToursData.data || []).filter((tour) => {
          const status = (tour.status || '').toLowerCase();
          const assignedDriverId =
            tour.assigned_driver_id ||
            tour.driver_id ||
            tour.accepted_by ||
            tour.assignee_id ||
            tour.accepted_driver_id ||
            tour.assigned_to_driver_id ||
            tour.assigned_to ||
            tour.accepted_by_driver_id ||
            tour.accepted_driver ||
            tour.taken_by ||
            tour.claimed_by;
        return status === 'waiting_for_driver' && !assignedDriverId;
        });
        setAvailableCustomTours(filtered);
      } else {
        setAvailableCustomTours([]);
      }
    } catch (error) {
      console.error('Error fetching available custom tours:', error);
      setAvailableCustomTours([]);
    }
  };

  const fetchAvailableRideBookings = async () => {
    try {
      const rideData = await getAvailableRideBookings();
      if (rideData?.success && Array.isArray(rideData?.data)) {
        const processedRides = rideData.data.map(ride => ({
          id: ride.id,
          package_name: 'Ride Hailing',
          booking_date: ride.created_at,
          pickup_time: 'ASAP',
          number_of_pax: 1,
          pickup_address: ride.pickup_address,
          dropoff_address: ride.dropoff_address,
          contact_number: 'N/A',
          total_amount: null,
          status: ride.status,
          request_type: 'ride_hailing',
          booking_reference: `RH-${String(ride.id).slice(0, 8)}`,
          customer_id: ride.customer_id,
          notes: ride.notes
        }));
        setAvailableRideBookings(processedRides);
      } else {
        setAvailableRideBookings([]);
      }
    } catch (error) {
      console.error('Error fetching available ride bookings:', error);
      setAvailableRideBookings([]);
    }
  };

  const fetchDriverCustomTours = async (driverId) => {
    try {
      const res = await getDriverCustomTours(driverId);
      if (res.success) {
        const mapped = (res.data || []).map((tour) => ({
          id: tour.id,
          status: tour.status,
          package_name: tour.destination || 'Custom Tour',
          booking_date: tour.preferred_date || tour.created_at,
          pickup_time: tour.preferred_time || '09:00:00',
          number_of_pax: tour.number_of_pax,
          pickup_address: tour.pickup_location || tour.event_address || 'N/A',
          contact_number: tour.contact_number,
          total_amount: tour.approved_price || tour.estimated_price || null,
          request_type: 'custom_tour',
          booking_reference: tour.booking_reference || tour.reference || tour.ref || `CT-${String(tour.id).slice(0, 8)}`,
          customer_id: tour.customer_id || tour.requested_by || tour.tourist_id || null,
        }));

        setDriverBookings((prev) => {
          const nonCustom = prev.filter((b) => b.request_type !== 'custom_tour');
          return [...nonCustom, ...mapped];
        });
      }
    } catch (e) {
      console.error('Error fetching driver custom tours:', e);
    }
  };

  const fetchDriverBookings = async (driverId) => {
    try {
      const bookingsData = await getDriverBookings(driverId);
      let processedBookings = [];
      if (bookingsData?.success && Array.isArray(bookingsData?.data?.bookings)) {
        processedBookings = bookingsData.data.bookings;
      } else if (bookingsData?.success && Array.isArray(bookingsData?.data)) {
        processedBookings = bookingsData.data;
      } else if (Array.isArray(bookingsData)) {
        processedBookings = bookingsData;
      } else if (Array.isArray(bookingsData?.results)) {
        processedBookings = bookingsData.results;
      } else {
        processedBookings = [];
      }
      
      // Also fetch driver's accepted ride hailing bookings
      try {
        const { getAllRideBookings } = require('../../services/rideHailingService');
        const allRides = await getAllRideBookings();
        if (allRides?.success && Array.isArray(allRides?.data)) {
          const driverRides = allRides.data.filter(ride => 
            ride.driver_id === driverId && 
            ['driver_assigned', 'in_progress'].includes(ride.status)
          ).map(ride => ({
            id: ride.id,
            package_name: 'Ride Hailing',
            booking_date: ride.created_at,
            pickup_time: 'ASAP',
            number_of_pax: 1,
            pickup_address: ride.pickup_address,
            dropoff_address: ride.dropoff_address,
            contact_number: 'N/A',
            total_amount: null,
            status: ride.status,
            request_type: 'ride_hailing',
            booking_reference: `RH-${String(ride.id).slice(0, 8)}`,
            customer_id: ride.customer_id,
            notes: ride.notes
          }));
          processedBookings = [...processedBookings, ...driverRides];
        }
      } catch (rideError) {
        console.error('Error fetching driver ride bookings:', rideError);
      }
      
      setDriverBookings(processedBookings);
    } catch (error) {
      console.error('Error fetching driver bookings:', error);
      setDriverBookings([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndBookings();
    setRefreshing(false);
  };

  // kept (unused now) to avoid touching logic elsewhere
  const refreshHistory = async () => {
    if (user) {
      await fetchDriverBookings(user.id);
    }
  };

  const handleAcceptBooking = async (booking) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // Check for schedule conflicts first
    try {
      const { driverScheduleService } = require('../../services/driverScheduleService');
      const conflictCheck = await driverScheduleService.checkAvailability(
        user.id,
        booking.booking_date,
        booking.pickup_time || '09:00'
      );

      if (!conflictCheck.available) {
        Alert.alert(
          'Schedule Conflict',
          conflictCheck.conflict_reason || 'You have a conflict at this time',
          [
            { text: 'OK' },
            { text: 'View Schedule', onPress: () => navigation.navigate('DriverSchedule') }
          ]
        );
        return;
      }
    } catch (error) {
      console.log('Schedule check failed, proceeding with booking:', error);
    }

    setSelectedBooking(booking);
    setShowAcceptModal(true);
  };

  const handleCompleteBooking = async (booking) => {
    setSelectedBooking(booking);
    setShowCompleteModal(true);
  };

  const handleStartTrip = async (booking) => {
    if (!booking || !user) return;
    try {
      setAcceptingBooking(true);
      let result;
      if (booking.request_type === 'custom_tour') {
        result = await updateCustomTourStatus(booking.id, 'in_progress');
        result = { success: !!(result && result.success), ...result };
      } else {
        result = await driverStartBooking(booking.id, user.id);
      }
      if (result && result.success !== false) {
        Alert.alert('Success', 'Trip started. Status set to In Progress.', [
          { text: 'OK', onPress: () => { fetchUserAndBookings(); } },
        ]);
      } else {
        Alert.alert('Error', result?.error || 'Failed to start trip');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', `Failed to start trip: ${error.message}`);
    } finally {
      setAcceptingBooking(false);
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!booking || !user) return;
    setBookingToCancel(booking);
    setShowDriverCancelModal(true);
  };

  const handleViewRideMap = async (ride) => {
    try {
      setSelectedRide(ride);
      
      // Parse coordinates from notes if available
      let pickupCoords = null;
      let dropoffCoords = null;
      
      if (ride.notes) {
        const pickupMatch = ride.notes.match(/Pickup: ([\d.-]+), ([\d.-]+)/);
        const dropoffMatch = ride.notes.match(/Dropoff: ([\d.-]+), ([\d.-]+)/);
        
        if (pickupMatch) {
          pickupCoords = {
            latitude: parseFloat(pickupMatch[1]),
            longitude: parseFloat(pickupMatch[2])
          };
        }
        
        if (dropoffMatch) {
          dropoffCoords = {
            latitude: parseFloat(dropoffMatch[1]),
            longitude: parseFloat(dropoffMatch[2])
          };
        }
      }
      
      // Store coordinates in the ride object for the modal
      setSelectedRide({
        ...ride,
        pickupCoords,
        dropoffCoords
      });
      
      setShowRideMapModal(true);
    } catch (error) {
      console.error('Error preparing ride map:', error);
      setSelectedRide(ride);
      setShowRideMapModal(true);
    }
  };

  const handleDriverCancellationSuccess = (result) => {
    setShowDriverCancelModal(false);
    setBookingToCancel(null);
    
    if (result.success) {
      let message = result.message || 'Booking cancelled and reassigned to other drivers.';
      
      if (result.driver_suspended) {
        message += '\n\nNote: Your account has been temporarily suspended due to multiple cancellations.';
      }
      
      Alert.alert('Booking Cancelled', message, [
        { 
          text: 'OK', 
          onPress: () => { 
            setTimeout(() => fetchUserAndBookings(), 1000);
          } 
        },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to cancel booking');
    }
  };

  const canStartToday = (booking) => {
    if (!booking?.booking_date) return true;
    try {
      const sched = String(booking.booking_date).split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      return today >= sched;
    } catch {
      return true;
    }
  };

  const confirmAcceptBooking = async () => {
    if (!selectedBooking || !user) return;

    try {
      setAcceptingBooking(true);

      let result;
      const driverData = {
        driver_id: user.id,
        driver_name: user.name || user.user_metadata?.name || user.email || 'Driver',
      };

      if (selectedBooking.request_type === 'custom_tour') {
        result = await driverAcceptCustomTourRequest(selectedBooking.id, driverData);
      } else if (selectedBooking.request_type === 'ride_hailing') {
        result = await acceptRideBooking(selectedBooking.id, driverData);
      } else {
        result = await driverAcceptBooking(selectedBooking.id, driverData);
      }

      if (result.success) {
        const message =
          selectedBooking.request_type === 'custom_tour'
            ? 'Custom tour request accepted successfully!'
            : 'Booking accepted successfully!';

        if (selectedBooking.request_type === 'custom_tour') {
          try { await updateCustomTourStatus(selectedBooking.id, 'driver_assigned'); } catch {}
        }

        Alert.alert('Success', message, [
          {
            text: 'OK',
            onPress: () => {
              setShowAcceptModal(false);
              setSelectedBooking(null);
              if (selectedBooking.request_type === 'custom_tour') {
                setAvailableCustomTours((prev) => prev.filter((t) => t.id !== selectedBooking.id));
                fetchDriverCustomTours(user.id);
              }
              // Add delay to allow backend to process the acceptance
              setTimeout(() => fetchUserAndBookings(), 2000);
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept booking');
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', `Failed to accept booking: ${error.message}`);
    } finally {
      setAcceptingBooking(false);
    }
  };

  const confirmCompleteBooking = async () => {
    if (!selectedBooking || !user) return;
    const isCustom = selectedBooking.request_type === 'custom_tour';
    
    try {
      setAcceptingBooking(true);
      let result;
      
      if (isCustom) {
        result = await updateCustomTourStatus(selectedBooking.id, 'completed');
        result = { success: !!(result && result.success), ...result };
      } else if (selectedBooking.request_type === 'ride_hailing') {
        result = await completeRideBooking(selectedBooking.id, { driver_id: user.id });
      } else {
        // Use verification-aware completion
        result = await completeBookingWithVerification(selectedBooking.id, user.id);

        if (result.verification_required) {
          setShowCompleteModal(false);
          setBookingToVerify(selectedBooking);
          setShowVerificationModal(true);
          Alert.alert(
            'Verification Required',
            'Please upload a verification photo before completing this booking.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      
      if (result.success) {
        Alert.alert('Success', 'Booking marked as completed.', [
          {
            text: 'View Earnings',
            onPress: () => {
              setShowCompleteModal(false);
              setSelectedBooking(null);
              fetchUserAndBookings();
              navigation.navigate(Routes.DRIVER_EARNINGS);
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to complete booking');
      }
    } catch (error) {
      console.error('Error completing booking:', error);
      Alert.alert('Error', `Failed to complete booking: ${error.message}`);
    } finally {
      setAcceptingBooking(false);
    }
  };

  const handleVerificationSuccess = () => {
    setShowVerificationModal(false);
    setBookingToVerify(null);
    fetchUserAndBookings();
    Alert.alert(
      'Trip Completed!',
      'Verification photo uploaded successfully. Your booking is now complete and earnings have been processed.',
      [{
        text: 'View Earnings',
        onPress: () => navigation.navigate(Routes.DRIVER_EARNINGS)
      }]
    );
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'waiting_for_driver':
        return '#B26A00';
      case 'driver_assigned':
      case 'confirmed':
      case 'accepted':
        return '#2E7D32';
      case 'in_progress':
      case 'ongoing':
        return '#1565C0';
      case 'completed':
        return '#2E7D32';
      case 'cancelled':
        return '#C62828';
      case 'pending':
        return '#7B1FA2';
      case 'approved':
        return '#2E7D32';
      case 'rejected':
        return '#C62828';
      default:
        return '#555';
    }
  };

  const getStatusIcon = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'waiting_for_driver':
        return 'time';
      case 'driver_assigned':
      case 'confirmed':
      case 'accepted':
        return 'checkmark-circle';
      case 'in_progress':
      case 'ongoing':
        return 'car';
      case 'completed':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return timeString;
  };

  const formatCurrencyLocal = (amount) => {
    if (!amount) return 'N/A';
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  const getTouristProfile = async (customerId) => {
    if (!customerId || customerId === 'undefined') {
      console.warn('No valid customerId provided');
      return { id: null, name: 'Tourist' };
    }

    const { data, error } = await supabase
      .from('public_user_profiles')
      .select('id, name')
      .eq('id', customerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching tourist profile:', error);
      return { id: customerId, name: 'Tourist' };
    }
    return data || { id: customerId, name: 'Tourist' };
  };


const getCustomTitle = (r) => (
  r?.request_type === 'special_event'
    ? (r?.event_type || 'Special Event')
    : (r?.destination || r?.route || 'Custom Tour')
);

    // Add this function above the renderBookingCard function
  const renderMessageButton = (booking) => (
    <TouchableOpacity 
      style={[styles.acceptButton, styles.messageBtn]} 
      onPress={async () => {
        try {
          // Get tourist profile first
          const tourist = await getTouristProfile(booking.customer_id);
          const participantRole = booking.request_type === 'special_event' ? 'owner' : 'driver';
          let requestType;
          if (booking.request_type === 'special_event') {
            requestType = 'special_event_request';
          } else if (booking.request_type === 'custom_tour') {
            requestType = 'custom_tour_package';
          } else {
            requestType = 'package_booking';  // Standard tour packages
          }
          
          let packageId = null;
          let eventId = null;
          
          if (booking.request_type === 'special_event') {
            eventId = booking.special_event_request_id || null;
          } else if (booking.request_type === 'custom_tour') {
            packageId = booking.custom_tour_package_id || null;
          }
        // Format subject line appropriately based on booking type
        let subject;
        if (booking.request_type === 'special_event') {
          subject = `Special Event: ${getCustomTitle(booking)}`;
        } else if (booking.request_type === 'custom_tour') {
          subject = `Custom Tour: ${getCustomTitle(booking)}`;
        } else {
          subject = `Tour: ${booking.package_name || 'Package'}`;
        }
          navigation.navigate('Communication', {
            screen: 'ChatRoom',
            params: { 
              bookingId: booking.id,
              subject: subject,
              participantRole: participantRole,
              requestType: requestType,
              packageId: packageId || null,
              eventId: eventId || null,
              contactName: tourist.name
            }
          });
        } catch (error) {
          console.error('Error getting tourist info:', error);
          // Fallback navigation if tourist lookup fails
          navigation.navigate('Communication', {
            screen: 'ChatRoom',
            params: {
              bookingId: booking.id,
              subject: `Custom Tour: ${getCustomTitle(booking)}`,
              participantRole: 'driver',
              requestType: 'custom_tour_package',
              packageId: null,
              eventId: null,
              contactName: 'Tourist'
            }
          });
        }
      }}>
      <Ionicons name="chatbubble-outline" size={18} color="#fff" />
      <Text style={styles.acceptButtonText}>Message Tourist</Text>
    </TouchableOpacity>
  );
  const renderBookingCard = (booking) => (
    <View key={booking.id} style={[
      styles.bookingCard, 
      booking.request_type === 'ride_hailing' && styles.rideHailingCard
    ]}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingReference}>Ref: {booking.booking_reference || 'N/A'}</Text>
          <Text style={styles.bookingDate}>{formatDate(booking.booking_date)}</Text>
          {booking.request_type === 'ride_hailing' && (
            <View style={styles.rideHailingBadge}>
              <Text style={styles.rideHailingBadgeText}>RIDE HAILING</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusContainer, { borderColor: getStatusColor(booking.status) }]}>
          <Ionicons name={getStatusIcon(booking.status)} size={16} color={getStatusColor(booking.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
            {booking.status?.replace('_', ' ') || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Package:</Text>
          <Text style={styles.detailValue}>{booking.package_name || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Pickup Time:</Text>
          <Text style={styles.detailValue}>{formatTime(booking.pickup_time)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers:</Text>
          <Text style={styles.detailValue}>{booking.number_of_pax || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Pickup Address:</Text>
          <Text style={styles.detailValue}>{booking.pickup_address || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{booking.contact_number || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Amount:</Text>
          <Text style={styles.detailValue}>{formatCurrencyLocal(booking.total_amount)}</Text>
        </View>

        {booking.special_requests && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Special Requests:</Text>
            <Text style={styles.detailValue}>{booking.special_requests}</Text>
          </View>
        )}
      </View>

      {booking.status === 'pending' && activeTab === 'available' && (
        booking.cancelled_by_driver_id === user?.id ? (
          <View style={[styles.acceptButton, styles.disabledButton]}>
            <Ionicons name="block" size={18} color="#999" />
            <Text style={[styles.acceptButtonText, { color: '#999' }]}>Cannot Accept (Previously Cancelled)</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptBooking(booking)}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept Booking</Text>
          </TouchableOpacity>
        )
      )}

      {activeTab === 'ongoing' && (booking.status === 'in_progress' || booking.status === 'ongoing') && (
        <>
          <TouchableOpacity style={[styles.acceptButton, styles.completeBtn]} onPress={() => handleCompleteBooking(booking)}>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Complete Booking</Text>
          </TouchableOpacity>
          {renderMessageButton(booking)}
        </>
      )}
      {activeTab === 'ongoing' && (booking.status === 'confirmed' || booking.status === 'driver_assigned') && booking.payment_status !== 'paid' && booking.request_type !== 'ride_hailing' && (
        <View style={[styles.acceptButton, styles.disabledButton]}>
          <Ionicons name="card" size={18} color="#999" />
          <Text style={[styles.acceptButtonText, { color: '#999' }]}>Waiting for Payment</Text>
        </View>
      )}
      {activeTab === 'ongoing' && (booking.status === 'driver_assigned' || booking.status === 'accepted') && booking.request_type !== 'ride_hailing' && (
        <>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: canStartToday(booking) ? '#1976D2' : '#9E9E9E' }]}
            onPress={() => canStartToday(booking) && handleStartTrip(booking)}
            disabled={!canStartToday(booking) || acceptingBooking}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>
              {canStartToday(booking) ? 'Start Trip' : `Starts on ${formatDate(booking.booking_date)}`}
            </Text>
          </TouchableOpacity>
          {renderMessageButton(booking)}
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: '#C62828', marginTop: 8 }]}
            onPress={() => handleCancelBooking(booking)}
            disabled={acceptingBooking}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Cancel Booking</Text>
          </TouchableOpacity>
        </>
      )}
      {activeTab === 'ongoing' && (booking.status === 'driver_assigned' || booking.status === 'accepted') && booking.request_type === 'ride_hailing' && (
        <>
          <View style={[styles.acceptButton, styles.disabledButton]}>
            <Ionicons name="car" size={18} color="#999" />
            <Text style={[styles.acceptButtonText, { color: '#999' }]}>Trip Started Automatically</Text>
          </View>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: '#C62828', marginTop: 8 }]}
            onPress={() => handleCancelBooking(booking)}
            disabled={acceptingBooking}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderRideHailingCard = (ride) => (
    <View key={ride.id} style={[styles.bookingCard, styles.rideHailingCard]}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingReference}>Ref: {ride.booking_reference}</Text>
          <View style={styles.rideHailingBadge}>
            <Text style={styles.rideHailingBadgeText}>RIDE HAILING</Text>
          </View>
        </View>
        <View style={[styles.statusContainer, { borderColor: getStatusColor(ride.status) }]}>
          <Ionicons name={getStatusIcon(ride.status)} size={16} color={getStatusColor(ride.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(ride.status) }]}>
            {ride.status?.replace('_', ' ') || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Service:</Text>
          <Text style={styles.detailValue}>Point-to-Point Ride</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Pickup:</Text>
          <Text style={styles.detailValue}>{ride.pickup_address}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Destination:</Text>
          <Text style={styles.detailValue}>{ride.dropoff_address}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Requested:</Text>
          <Text style={styles.detailValue}>{formatDate(ride.booking_date)}</Text>
        </View>

        {ride.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Notes:</Text>
            <Text style={styles.detailValue}>{ride.notes}</Text>
          </View>
        )}
      </View>

      {ride.status === 'waiting_for_driver' && activeTab === 'available' && (
        <>
          <TouchableOpacity style={[styles.acceptButton, styles.viewMapButton]} onPress={() => handleViewRideMap(ride)}>
            <Ionicons name="map" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>View Route</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.acceptButton, styles.rideHailingAcceptButton]} onPress={() => handleAcceptBooking(ride)}>
            <Ionicons name="car" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept Ride</Text>
          </TouchableOpacity>
        </>
      )}
      
      {activeTab === 'ongoing' && ride.status === 'driver_assigned' && (
        <>
          <View style={[styles.acceptButton, styles.disabledButton]}>
            <Ionicons name="car" size={18} color="#999" />
            <Text style={[styles.acceptButtonText, { color: '#999' }]}>Trip In Progress</Text>
          </View>
          <TouchableOpacity style={[styles.acceptButton, styles.rideHailingAcceptButton]} onPress={() => handleCompleteBooking(ride)}>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Complete Ride</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderCustomTourCard = (tour) => (
    <View key={tour.id} style={[styles.bookingCard, styles.customTourCard]}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingReference}>Custom Tour #{tour.id.substring(0, 8)}</Text>
          <View style={styles.customTourBadge}>
            <Text style={styles.customTourBadgeText}>CUSTOM</Text>
          </View>
        </View>
        <View style={[styles.statusContainer, { borderColor: getStatusColor(tour.status) }]}>
          <Ionicons name={getStatusIcon(tour.status)} size={16} color={getStatusColor(tour.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(tour.status) }]}>
            {tour.status?.replace('_', ' ') || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Destination:</Text>
          <Text style={styles.detailValue}>{tour.destination || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Customer:</Text>
          <Text style={styles.detailValue}>{tour.customer_name || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers:</Text>
          <Text style={styles.detailValue}>{tour.number_of_pax || 'N/A'}</Text>
        </View>

        {tour.pickup_location && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup Location:</Text>
            <Text style={styles.detailValue}>{tour.pickup_location}</Text>
          </View>
        )}

        {tour.preferred_date && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Preferred Date:</Text>
            <Text style={styles.detailValue}>{formatDate(tour.preferred_date)}</Text>
          </View>
        )}

        {tour.preferred_duration_hours && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>{tour.preferred_duration_hours} hours</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{tour.contact_number || 'N/A'}</Text>
        </View>

        {tour.approved_price && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Approved Price:</Text>
            <Text style={styles.detailValue}>{formatCurrencyLocal(tour.approved_price)}</Text>
          </View>
        )}

        {tour.special_requests && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Special Requests:</Text>
            <Text style={styles.detailValue}>{tour.special_requests}</Text>
          </View>
        )}
      </View>

      {(tour.status === 'waiting_for_driver' || tour.status === 'pending') && activeTab === 'available' && (
        tour.cancelled_by_driver_id === user?.id ? (
          <View style={[styles.acceptButton, styles.customTourAcceptButton, styles.disabledButton]}>
            <Ionicons name="block" size={18} color="#999" />
            <Text style={[styles.acceptButtonText, { color: '#999' }]}>Cannot Accept (Previously Cancelled)</Text>
          </View>
        ) : (
          <TouchableOpacity style={[styles.acceptButton, styles.customTourAcceptButton]} onPress={() => handleAcceptBooking(tour)}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept Tour</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={activeTab === 'available' ? 'car-outline' : activeTab === 'ongoing' ? 'time-outline' : 'checkmark-done-circle'}
        size={64}
        color="#C9C9C9"
      />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'available'
          ? 'No Available Bookings or Custom Tours'
          : activeTab === 'ongoing'
          ? 'No Ongoing Bookings'
          : 'No Booking History'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {activeTab === 'available'
          ? 'There are currently no bookings or custom tours waiting for drivers. Check back later!'
          : activeTab === 'ongoing'
          ? 'You have no ongoing bookings. Accepted bookings appear here until you complete them.'
          : "You haven't accepted any bookings yet. Start by accepting available bookings!"}
      </Text>
      {/* Empty-state refresh (kept) */}
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'available' && styles.activeTabButton]}
        onPress={() => setActiveTab('available')}
      >
        <Ionicons name="car-outline" size={18} color={activeTab === 'available' ? '#6B2E2B' : '#777'} />
        <Text style={[styles.tabButtonText, activeTab === 'available' && styles.activeTabButtonText]}>Available</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'ongoing' && styles.activeTabButton]}
        onPress={() => setActiveTab('ongoing')}
      >
        <Ionicons name="time-outline" size={18} color={activeTab === 'ongoing' ? '#6B2E2B' : '#777'} />
        <Text style={[styles.tabButtonText, activeTab === 'ongoing' && styles.activeTabButtonText]}>Ongoing</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
        onPress={() => setActiveTab('history')}
      >
        <Ionicons name="checkmark-done-circle" size={18} color={activeTab === 'history' ? '#6B2E2B' : '#777'} />
        <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>History</Text>
      </TouchableOpacity>
    </View>
  );

  const ongoingBookings = driverBookings.filter((booking) => {
    const status = (booking.status || '').toLowerCase();
    // Include all statuses that represent ongoing trips
    return status === 'confirmed' || status === 'driver_assigned' || status === 'in_progress';
  });
  const historyBookings = driverBookings.filter((booking) => {
    const status = (booking.status || '').toLowerCase();
    return status === 'completed';
  });

  const currentBookings =
    activeTab === 'available' ? [...availableBookings, ...availableRideBookings] : activeTab === 'ongoing' ? ongoingBookings : historyBookings;

  const currentCustomTours = activeTab === 'available' ? availableCustomTours : [];

  // ====== Animated helpers for modals ======
  const acceptTranslateY = acceptAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const acceptOpacity = acceptAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const completeTranslateY = completeAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const completeOpacity = completeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.container}>
      {/* Global Notification Manager */}
      <NotificationManager navigation={navigation} />
      
      {/* Custom header with Chat + Notifications */}
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'available'
              ? 'Available Bookings & Custom Tours'
              : activeTab === 'ongoing'
              ? 'Ongoing Bookings'
              : 'Booking History'}
          </Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'Driver'}
            {'\u2019'}s {activeTab === 'available' ? 'available' : activeTab === 'ongoing' ? 'ongoing' : 'completed'} bookings
          </Text>
          {/* Manual header refresh buttons removed as requested */}
        </View>

        {renderTabBar()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>
              Loading {activeTab === 'available' ? 'available' : activeTab === 'ongoing' ? 'ongoing' : 'history'} bookings...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {currentBookings.length > 0 || currentCustomTours.length > 0 ? (
              <>
                {currentBookings.map(renderBookingCard)}
                {currentCustomTours.map(renderCustomTourCard)}
              </>
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
        )}
      </View>

      {/* Accept Booking - Modern bottom-sheet modal */}
      <Modal
        visible={showAcceptModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAcceptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !acceptingBooking && setShowAcceptModal(false)} />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: acceptTranslateY }], opacity: acceptOpacity },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>
                {selectedBooking?.request_type === 'custom_tour' ? 'Accept Custom Tour' : 'Accept Booking'}
              </Text>
              <TouchableOpacity
                onPress={() => !acceptingBooking && setShowAcceptModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Are you sure you want to accept this{' '}
              {selectedBooking?.request_type === 'custom_tour' ? 'custom tour request' : 'booking'}?
            </Text>

            {selectedBooking && (
              <View style={styles.modalBookingInfo}>
                {selectedBooking.request_type === 'custom_tour' ? (
                  <>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Destination: </Text>
                      {selectedBooking.destination || 'N/A'}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Customer: </Text>
                      {selectedBooking.customer_name || 'N/A'}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Passengers: </Text>
                      {selectedBooking.number_of_pax}
                    </Text>
                    {selectedBooking.preferred_date && (
                      <Text style={styles.modalBookingText}>
                        <Text style={styles.modalLabel}>Preferred Date: </Text>
                        {formatDate(selectedBooking.preferred_date)}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Package: </Text>
                      {selectedBooking.package_name}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Date: </Text>
                      {formatDate(selectedBooking.booking_date)}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Passengers: </Text>
                      {selectedBooking.number_of_pax}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Pickup: </Text>
                      {selectedBooking.pickup_address}
                    </Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.sheetButtons}>
              <TouchableOpacity
                style={[styles.btnSecondary, acceptingBooking && styles.disabledButton]}
                onPress={() => setShowAcceptModal(false)}
                disabled={acceptingBooking}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, acceptingBooking && styles.disabledButton]}
                onPress={confirmAcceptBooking}
                disabled={acceptingBooking}
              >
                <Text style={styles.btnPrimaryText}>{acceptingBooking ? 'Accepting...' : 'Accept'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Complete Booking - Modern bottom-sheet modal */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !acceptingBooking && setShowCompleteModal(false)} />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: completeTranslateY }], opacity: completeOpacity },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIcon, { backgroundColor: 'rgba(25, 118, 210, 0.12)' }]}>
                <Ionicons name="checkmark-done" size={22} color="#1976D2" />
              </View>
              <Text style={styles.modalTitle}>Complete Booking</Text>
              <TouchableOpacity
                onPress={() => !acceptingBooking && setShowCompleteModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#777" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Are you sure you want to mark this booking as completed?
            </Text>

            {selectedBooking && (
              <View style={styles.modalBookingInfo}>
                <Text style={styles.modalBookingText}>
                  <Text style={styles.modalLabel}>Package: </Text>
                  {selectedBooking.package_name}
                </Text>
                <Text style={styles.modalBookingText}>
                  <Text style={styles.modalLabel}>Date: </Text>
                  {formatDate(selectedBooking.booking_date)}
                </Text>
                <Text style={styles.modalBookingText}>
                  <Text style={styles.modalLabel}>Passengers: </Text>
                  {selectedBooking.number_of_pax}
                </Text>
              </View>
            )}

            <View style={styles.sheetButtons}>
              <TouchableOpacity
                style={[styles.btnSecondary, acceptingBooking && styles.disabledButton]}
                onPress={() => setShowCompleteModal(false)}
                disabled={acceptingBooking}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimaryBlue, acceptingBooking && styles.disabledButton]}
                onPress={confirmCompleteBooking}
                disabled={acceptingBooking}
              >
                <Text style={styles.btnPrimaryText}>
                  {acceptingBooking ? 'Completing...' : 'Complete'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Verification Photo Modal */}
      <VerificationPhotoModal
        visible={showVerificationModal}
        onClose={() => {
          setShowVerificationModal(false);
          setBookingToVerify(null);
        }}
        booking={bookingToVerify}
        driverId={user?.id}
        onSuccess={handleVerificationSuccess}
      />

      {/* Enhanced Driver Cancellation Modal */}
      <DriverCancellationModal
        visible={showDriverCancelModal}
        onClose={() => {
          setShowDriverCancelModal(false);
          setBookingToCancel(null);
        }}
        booking={bookingToCancel}
        driverId={user?.id}
        onCancellationSuccess={handleDriverCancellationSuccess}
        bookingType={bookingToCancel?.request_type === 'ride_hailing' ? 'ride' : 'tour'}
      />

      {/* Ride Map Modal */}
      <Modal
        visible={showRideMapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRideMapModal(false)}
      >
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModalContainer}>
            <View style={styles.mapModalHeader}>
              <Text style={styles.mapModalTitle}>Ride Route</Text>
              <TouchableOpacity onPress={() => setShowRideMapModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedRide && (
              <View style={styles.mapModalInfo}>
                <View style={styles.mapInfoRow}>
                  <Ionicons name="location" size={16} color="#2E7D32" />
                  <Text style={styles.mapInfoText}>{selectedRide.pickup_address}</Text>
                </View>
                <View style={styles.mapInfoRow}>
                  <Ionicons name="flag" size={16} color="#C62828" />
                  <Text style={styles.mapInfoText}>{selectedRide.dropoff_address}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.mapContainer}>
              {selectedRide && <RideMap ride={selectedRide} />}
            </View>
            
            <TouchableOpacity 
              style={[styles.acceptButton, styles.rideHailingAcceptButton, { margin: 16 }]} 
              onPress={() => {
                setShowRideMapModal(false);
                handleAcceptBooking(selectedRide);
              }}
            >
              <Ionicons name="car" size={18} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept This Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Page */
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { flex: 1, paddingHorizontal: 16 },

  /* Header (screen’s own title section under TARTRACKHeader) */
  header: { paddingVertical: 18, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#222', marginBottom: 6, letterSpacing: 0.2, textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#777', textAlign: 'center', marginBottom: 10 },

  /* Tabs */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE7E6',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTabButton: { backgroundColor: 'rgba(107,46,43,0.10)' },
  tabButtonText: { fontSize: 13, fontWeight: '700', color: '#777', marginLeft: 8 },
  activeTabButtonText: { color: '#6B2E2B' },

  /* List */
  scrollView: { flex: 1 },

  /* Card */
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE7E6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEE',
  },
  bookingInfo: { flex: 1, paddingRight: 8 },
  bookingReference: { fontSize: 14, fontWeight: '800', color: '#222', marginBottom: 2 },
  bookingDate: { fontSize: 12, color: '#888' },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#F7F7F7',
    gap: 6,
  },
  statusText: { fontSize: 12, fontWeight: '800' },

  bookingDetails: { gap: 8, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: 13, color: '#777', fontWeight: '600', flex: 1, paddingRight: 10 },
  detailValue: { fontSize: 13, color: '#222', flex: 2, textAlign: 'right' },

  /* Buttons */
  acceptButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  completeBtn: { backgroundColor: '#1976D2' },
  acceptButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  /* Loading */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  loadingText: { fontSize: 14, color: '#777' },

  /* Empty */
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 56 },
  emptyStateTitle: { fontSize: 18, fontWeight: '800', color: '#222', marginTop: 12, marginBottom: 6 },
  emptyStateSubtitle: { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 18, paddingHorizontal: 20 },

  /* Header small button (used only in empty state now) */
  refreshButton: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  refreshButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  /* === Modals (Bottom Sheet) === */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#EDE7E6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E7E2E1',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: { fontSize: 18, fontWeight: '900', color: '#222', textAlign: 'center', flex: 1 },
  modalText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 12 },

  modalBookingInfo: {
    backgroundColor: '#FAF7F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDE7E6',
  },
  modalBookingText: { fontSize: 13, color: '#222', marginBottom: 4 },
  modalLabel: { fontWeight: '800' },

  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0DFDF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#333', fontSize: 14, fontWeight: '800' },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryBlue: {
    flex: 1,
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },

  /* Custom tour accent */
  customTourCard: { borderLeftWidth: 4, borderLeftColor: '#9C27B0' },
  customTourBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  customTourBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  customTourAcceptButton: { backgroundColor: '#9C27B0' },
  
  /* Ride hailing accent */
  rideHailingCard: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  rideHailingBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  rideHailingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rideHailingAcceptButton: { backgroundColor: '#FF9800' },
  messageBtn: { 
    backgroundColor: '#1565C0', 
    marginTop: 8,
    marginBottom: 8
  },
  viewMapButton: {
    backgroundColor: '#1976D2',
    marginTop: 8
  },
  
  /* Map Modal Styles */
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  mapModalContainer: {
    width: '90%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden'
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE7E6'
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222'
  },
  mapModalInfo: {
    padding: 16,
    backgroundColor: '#F8F9FA'
  },
  mapInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  mapInfoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EDE7E6'
  },
});

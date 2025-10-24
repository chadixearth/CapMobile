import networkClient from './networkClient';
import { invalidateData } from './dataInvalidationService';

// Helper function for API calls with improved error handling
async function apiCall(endpoint, options = {}) {
  try {
    const result = await networkClient.request(endpoint, options);
    
    // Emit data change events for successful operations (only for write operations)
    if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
      if (endpoint.includes('/ride-hailing/')) {
        invalidateData.rides();
        invalidateData.bookings();
      }
      if (endpoint.includes('/complete/') || endpoint.includes('/driver-cancel/') || endpoint.includes('/customer-cancel/')) {
        invalidateData.earnings();
      }
      if (endpoint.includes('/payment/') || endpoint.includes('/pay/')) {
        invalidateData.payments();
        invalidateData.bookings();
      }
      if (endpoint.includes('/profile/') || endpoint.includes('/user/')) {
        invalidateData.profile();
      }
      if (endpoint.includes('/review/') || endpoint.includes('/rating/')) {
        invalidateData.reviews();
      }
      if (endpoint.includes('/custom/') || endpoint.includes('/special/')) {
        invalidateData.customRequests();
      }
      if (endpoint.includes('/carriage/') || endpoint.includes('/vehicle/')) {
        invalidateData.carriages();
      }
      if (endpoint.includes('/map/') || endpoint.includes('/route/')) {
        invalidateData.mapData();
      }
    }
    
    return result;
  } catch (error) {
    // Handle database schema errors specifically
    if (error.message && error.message.includes('ride_type') && error.message.includes('schema cache')) {
      console.error(`Database schema error for ${endpoint}:`, error.message);
      return { 
        success: false, 
        error: 'Database schema error - ride_type column missing', 
        error_code: 'DATABASE_SCHEMA_ERROR'
      };
    }
    
    // Handle HTTP 405 errors specifically
    if (error.message && error.message.includes('405')) {
      console.warn(`Method not allowed for ${endpoint}:`, error.message);
      return { success: false, error: 'Method not allowed', data: [] };
    }
    
    // Don't log JWT expiry errors
    if (!error.message?.includes('JWT expired') && !error.message?.includes('PGRST301')) {
      console.error('API call failed:', error);
    }
    throw error;
  }
}

// Check for active rides before creating new ones
export async function checkActiveRide(userId, userType = 'customer') {
  try {
    const result = await apiCall(`/ride-hailing/check-active-ride/?user_id=${userId}&user_type=${userType}`);
    return result;
  } catch (error) {
    console.error('Error checking active ride:', error);
    return { success: false, has_active_ride: false, error: error.message };
  }
}

// Monitor ride wait time and suggest cancellation
export async function monitorRideWaitTime(bookingId, onWaitTimeUpdate) {
  const checkInterval = setInterval(async () => {
    try {
      const waitResult = await checkRideWaitTime(bookingId);
      if (waitResult.success) {
        if (onWaitTimeUpdate) {
          onWaitTimeUpdate(waitResult);
        }
        
        // Stop monitoring if ride is no longer waiting
        if (!waitResult.waiting) {
          clearInterval(checkInterval);
        }
      }
    } catch (error) {
      console.error('Error monitoring wait time:', error);
    }
  }, 30000); // Check every 30 seconds
  
  return checkInterval;
}

// Validate user can create/accept rides
export async function validateRideAction(userId, userType, action = 'create') {
  try {
    const activeCheck = await checkActiveRide(userId, userType);
    
    if (!activeCheck.success) {
      return { canProceed: false, reason: 'Unable to check active rides', error: activeCheck.error };
    }
    
    if (activeCheck.has_active_ride) {
      const activeRides = activeCheck.active_rides || [];
      const activeStatuses = activeRides.map(r => r.status).join(', ');
      
      if (userType === 'customer') {
        return {
          canProceed: false,
          reason: `You have an active ride (${activeStatuses}). Complete or cancel it first.`,
          activeRides: activeRides
        };
      } else if (userType === 'driver') {
        return {
          canProceed: false,
          reason: `You have an active ride (${activeStatuses}). Complete or cancel it first.`,
          activeRides: activeRides
        };
      }
    }
    
    return { canProceed: true, reason: 'No active rides found' };
  } catch (error) {
    console.error('Error validating ride action:', error);
    return { canProceed: false, reason: 'Validation failed', error: error.message };
  }
}

// Create ride hailing booking with passenger count and location
export async function createRideBooking(bookingData) {
  try {
    // Validate required fields
    const required = ['customer_id', 'pickup_address', 'dropoff_address'];
    const missing = required.filter(field => !bookingData[field]);
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      };
    }

    // Validate passenger count
    const passengerCount = parseInt(bookingData.passenger_count || 1);
    if (passengerCount <= 0 || passengerCount > 4) {
      bookingData.passenger_count = 1;
    } else {
      bookingData.passenger_count = passengerCount;
    }
    
    // Validate user can create ride
    const validation = await validateRideAction(bookingData.customer_id, 'customer', 'create');
    
    if (!validation.canProceed) {
      console.log('Ride booking prevented - user has active ride:', validation.reason);
      return {
        success: false,
        error: validation.reason,
        error_code: 'ACTIVE_RIDE_EXISTS',
        active_rides: validation.activeRides
      };
    }
    
    // Get current location if not provided
    if (!bookingData.pickup_latitude || !bookingData.pickup_longitude) {
      try {
        const LocationService = (await import('./locationService')).default;
        const location = await LocationService.getCurrentLocation();
        bookingData.pickup_latitude = location.latitude;
        bookingData.pickup_longitude = location.longitude;
      } catch (locationError) {
        console.warn('Could not get current location:', locationError.message);
        // Return error if location is critical for the booking
        if (locationError.message.includes('Location services')) {
          return {
            success: false,
            error: locationError.message,
            error_code: 'LOCATION_ERROR'
          };
        }
        // Continue without coordinates for other errors
      }
    }
    
    // Remove undefined coordinate fields to avoid backend errors
    const cleanedData = { ...bookingData };
    if (!cleanedData.pickup_latitude) delete cleanedData.pickup_latitude;
    if (!cleanedData.pickup_longitude) delete cleanedData.pickup_longitude;
    if (!cleanedData.dropoff_latitude) delete cleanedData.dropoff_latitude;
    if (!cleanedData.dropoff_longitude) delete cleanedData.dropoff_longitude;
    
    // Add ride_type field with default value
    cleanedData.ride_type = bookingData.ride_type || 'standard';
    
    const result = await apiCall('/ride-hailing/', {
      method: 'POST',
      body: cleanedData
    });
    
    // Handle business logic errors that come back as success=false
    if (!result.success && result.error && result.error.includes('active ride request')) {
      console.log('Ride booking prevented - active ride exists');
      return {
        success: false,
        error: result.error,
        error_code: 'ACTIVE_RIDE_EXISTS'
      };
    }
    
    return result;
  } catch (error) {
    // Handle database schema errors specifically
    if (error.message && error.message.includes('ride_type') && error.message.includes('schema cache')) {
      console.error('Database schema error - ride_type column missing:', error.message);
      return {
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
        error_code: 'DATABASE_SCHEMA_ERROR'
      };
    }
    
    // Handle active ride error specifically (don't log as error)
    if (error.message && error.message.includes('active ride request')) {
      console.log('Ride booking prevented - active ride exists (from backend)');
      return {
        success: false,
        error: 'You already have an active ride request. Please wait for it to complete or cancel it first.',
        error_code: 'ACTIVE_RIDE_EXISTS'
      };
    }
    
    // Don't throw error for database schema issues - return graceful error instead
    if (error.message && error.message.includes('ride_type') && error.message.includes('schema cache')) {
      return {
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
        error_code: 'DATABASE_SCHEMA_ERROR'
      };
    }
    
    console.error('Error creating ride booking:', error);
    throw error;
  }
}

// Get available ride bookings for drivers
export async function getAvailableRideBookings() {
  try {
    const result = await apiCall('/ride-hailing/');
    
    if (!result.success) {
      return { success: false, error: result.error, data: [] };
    }
    
    // Extract rides array from different possible response structures
    let ridesArray = [];
    if (result.data?.data && Array.isArray(result.data.data)) {
      ridesArray = result.data.data;
    } else if (result.data && Array.isArray(result.data)) {
      ridesArray = result.data;
    } else if (Array.isArray(result)) {
      ridesArray = result;
    }
    
    // Filter for available rides (no driver assigned and waiting status)
    const availableRides = ridesArray.filter(ride => 
      ride && 
      (ride.status === 'waiting_for_driver' || ride.status === 'pending') && 
      !ride.driver_id
    );
    
    return {
      success: true,
      data: availableRides
    };
  } catch (error) {
    if (!error.message?.includes('JWT expired') && !error.message?.includes('PGRST301')) {
      console.error('Error fetching available ride bookings:', error);
    }
    return { success: false, error: error.message, data: [] };
  }
}

// Driver accepts ride booking
export async function acceptRideBooking(bookingId, driverData) {
  try {
    // Validate driver can accept ride
    const validation = await validateRideAction(driverData.driver_id, 'driver', 'accept');
    
    if (!validation.canProceed) {
      return {
        success: false,
        error: validation.reason,
        error_code: 'DRIVER_ACTIVE_RIDE_EXISTS',
        active_rides: validation.activeRides
      };
    }
    
    const result = await apiCall(`/ride-hailing/driver-accept/${bookingId}/`, {
      method: 'POST',
      body: driverData
    });
    
    return result;
  } catch (error) {
    console.error('Error accepting ride booking:', error);
    throw error;
  }
}

// Start ride booking (driver)
export async function startRideBooking(bookingId, driverData) {
  try {
    const result = await apiCall(`/ride-hailing/start/${bookingId}/`, {
      method: 'POST',
      body: driverData
    });
    
    return result;
  } catch (error) {
    console.error('Error starting ride booking:', error);
    throw error;
  }
}

// Complete ride booking
export async function completeRideBooking(bookingId, driverData) {
  try {
    const result = await apiCall(`/ride-hailing/complete/${bookingId}/`, {
      method: 'POST',
      body: driverData
    });
    
    return result;
  } catch (error) {
    console.error('Error completing ride booking:', error);
    throw error;
  }
}

// Cancel ride booking (customer)
export async function cancelRideBooking(bookingId, customerData) {
  try {
    const result = await apiCall(`/ride-hailing/customer-cancel/${bookingId}/`, {
      method: 'POST',
      body: customerData
    });
    
    return result;
  } catch (error) {
    console.error('Error cancelling ride booking:', error);
    throw error;
  }
}

// Cancel ride booking (driver)
export async function driverCancelRideBooking(bookingId, driverData) {
  try {
    const result = await apiCall(`/ride-hailing/driver-cancel/${bookingId}/`, {
      method: 'POST',
      body: driverData
    });
    
    // Emit data invalidation events for cancellation
    invalidateData.rides();
    invalidateData.bookings();
    invalidateData.earnings();
    
    return result;
  } catch (error) {
    console.error('Error driver cancelling ride booking:', error);
    throw error;
  }
}

// Get all ride bookings (for driver's accepted rides)
export async function getAllRideBookings() {
  try {
    const result = await apiCall('/ride-hailing/');
    return result;
  } catch (error) {
    console.error('Error fetching all ride bookings:', error);
    throw error;
  }
}

// Get routes by pickup point (for showing road highlights and destinations)
export async function getRoutesByPickup(pickupId) {
  try {
    const result = await apiCall(`/ride-hailing/routes-by-pickup/${pickupId}/`);
    
    // Handle different response structures
    if (result && result.success) {
      const data = result.data?.data || result.data || {};
      return {
        success: true,
        data: {
          available_destinations: data.available_destinations || [],
          road_highlights: data.road_highlights || [],
          color: data.color || '#007AFF'
        }
      };
    }
    
    // Return empty data structure if API call fails
    return {
      success: true,
      data: {
        available_destinations: [],
        road_highlights: [],
        color: '#007AFF'
      }
    };
  } catch (error) {
    // Don't log JWT expiry errors
    if (!error.message?.includes('JWT expired') && !error.message?.includes('PGRST301')) {
      console.error('Error fetching routes by pickup:', error);
    }
    return {
      success: true,
      data: {
        available_destinations: [],
        road_highlights: [],
        color: '#007AFF'
      },
      error: error.message
    };
  }
}







// Get user's active ride bookings for tracking
export async function getMyActiveRides(customerId) {
  try {
    const result = await apiCall(`/ride-hailing/`);
    // Filter client-side to avoid query parameter issues
    let ridesArray = [];
    if (result.success && result.data?.data && Array.isArray(result.data.data)) {
      ridesArray = result.data.data;
    } else if (result.success && result.data && Array.isArray(result.data)) {
      ridesArray = result.data;
    }
    
    if (ridesArray.length >= 0) {
      const activeRides = ridesArray.filter(ride => {
        if (!ride) return false;
        
        // Check if user is primary customer
        if (ride.customer_id === customerId) {
          return ['waiting_for_driver', 'driver_assigned', 'in_progress'].includes(ride.status);
        }
        
        // Check if user is in passengers array
        const passengers = ride.passengers || [];
        const isPassenger = passengers.some(p => p.customer_id === customerId);
        if (isPassenger) {
          return ['waiting_for_driver', 'driver_assigned', 'in_progress'].includes(ride.status);
        }
        
        return false;
      });
      return { success: true, data: activeRides };
    }
    return { success: false, error: 'No valid ride data received' };
  } catch (error) {
    // Don't log JWT expiry errors
    if (!error.message?.includes('JWT expired') && !error.message?.includes('PGRST301')) {
      console.error('Error fetching active rides:', error);
    }
    return { success: false, error: error.message };
  }
}

// Get driver location for tracking
export async function getDriverLocation(driverId) {
  try {
    const result = await apiCall(`/location/drivers/?driver_id=${driverId}`, {
      method: 'GET'
    });
    
    // Handle nested data structure: result.data.data or result.data
    let locationData = [];
    if (result.success && result.data) {
      if (Array.isArray(result.data.data)) {
        locationData = result.data.data;
      } else if (Array.isArray(result.data)) {
        locationData = result.data;
      }
    }
    
    if (locationData.length > 0) {
      const driverLocation = locationData.find(loc => loc.user_id === driverId);
      if (driverLocation) {
        return { 
          success: true, 
          data: {
            ...driverLocation,
            latitude: parseFloat(driverLocation.latitude),
            longitude: parseFloat(driverLocation.longitude)
          }
        };
      }
    }
    
    return { success: false, error: 'Driver location not found' };
  } catch (error) {
    if (!error.message?.includes('JWT expired') && !error.message?.includes('PGRST301')) {
      console.error('[getDriverLocation] Error:', error);
    }
    return { success: false, error: error.message };
  }
}

// Update driver location
export async function updateDriverLocation(userId, latitude, longitude, speed = 0, heading = 0) {
  try {
    const result = await apiCall('/location/update/', {
      method: 'POST',
      body: {
        user_id: userId,
        latitude,
        longitude,
        speed,
        heading
      }
    });
    return result;
  } catch (error) {
    if (!error.message?.includes('JWT expired') && !error.message?.includes('PGRST301')) {
      console.error('[updateDriverLocation] Error:', error);
    }
    return { success: false, error: error.message };
  }
}

// Check ride status for real-time updates
export async function checkRideStatus(bookingId) {
  try {
    const result = await apiCall(`/ride-hailing/${bookingId}/`);
    return result;
  } catch (error) {
    console.error('Error checking ride status:', error);
    return { success: false, error: error.message };
  }
}

// Check ride wait time and get cancellation suggestion
export async function checkRideWaitTime(bookingId) {
  try {
    const result = await apiCall(`/ride-hailing/ride-wait-time/${bookingId}/`);
    return result;
  } catch (error) {
    console.error('Error checking ride wait time:', error);
    return { success: false, error: error.message };
  }
}

// Get nearest available drivers
export async function getNearestDrivers(latitude, longitude, radiusKm = 5) {
  try {
    const LocationService = (await import('./locationService')).default;
    const nearestDrivers = await LocationService.findNearestDrivers(latitude, longitude, radiusKm);
    return { success: true, data: nearestDrivers };
  } catch (error) {
    console.error('Error getting nearest drivers:', error);
    return { success: false, error: error.message, data: [] };
  }
}

// Get active rides for a user
export async function getActiveRides(userId, userType = 'customer') {
  try {
    const result = await checkActiveRide(userId, userType);
    if (result.success && result.has_active_ride) {
      return {
        success: true,
        data: result.active_rides,
        count: result.count
      };
    }
    return {
      success: true,
      data: [],
      count: 0
    };
  } catch (error) {
    console.error('Error getting active rides:', error);
    return { success: false, error: error.message, data: [] };
  }
}


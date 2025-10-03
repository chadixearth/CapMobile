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
    // Handle HTTP 405 errors specifically
    if (error.message && error.message.includes('405')) {
      console.warn(`Method not allowed for ${endpoint}:`, error.message);
      return { success: false, error: 'Method not allowed', data: [] };
    }
    console.error('API call failed:', error);
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

// Create ride hailing booking with location
export async function createRideBooking(bookingData) {
  try {
    // Validate user can create ride
    const validation = await validateRideAction(bookingData.customer_id, 'customer', 'create');
    
    if (!validation.canProceed) {
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
        console.warn('Could not get current location:', locationError);
      }
    }
    
    const result = await apiCall('/ride-hailing/', {
      method: 'POST',
      body: bookingData
    });
    
    return result;
  } catch (error) {
    console.error('Error creating ride booking:', error);
    throw error;
  }
}

// Get available ride bookings for drivers
export async function getAvailableRideBookings() {
  try {
    const result = await apiCall('/ride-hailing/available-for-drivers/');
    return result;
  } catch (error) {
    console.error('Error fetching available ride bookings:', error);
    throw error;
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
    console.log(`[getRoutesByPickup] Calling API for pickup ID: ${pickupId}`);
    const result = await apiCall(`/ride-hailing/routes-by-pickup/${pickupId}/`);
    console.log(`[getRoutesByPickup] API response:`, result);
    
    // Handle nested response structure
    if (result && result.data && result.data.data) {
      return {
        success: true,
        data: result.data.data
      };
    } else if (result && result.data) {
      return {
        success: true,
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching routes by pickup:', error);
    return { success: false, error: error.message };
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
      const activeRides = ridesArray.filter(ride => 
        ride && ride.customer_id === customerId && 
        ['waiting_for_driver', 'driver_assigned', 'in_progress'].includes(ride.status)
      );
      return { success: true, data: activeRides };
    }
    return { success: false, error: 'No valid ride data received' };
  } catch (error) {
    console.error('Error fetching active rides:', error);
    return { success: false, error: error.message };
  }
}

// Get driver location for tracking
export async function getDriverLocation(driverId) {
  try {
    console.log(`[getDriverLocation] Fetching location for driver: ${driverId}`);
    const result = await apiCall(`/location/drivers/?driver_id=${driverId}`, {
      method: 'GET'
    });
    console.log(`[getDriverLocation] API response:`, result);
    
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
        console.log(`[getDriverLocation] Found location:`, driverLocation);
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
    
    console.log(`[getDriverLocation] Driver location not found in data:`, locationData);
    return { success: false, error: 'Driver location not found' };
  } catch (error) {
    console.error('[getDriverLocation] Error:', error);
    return { success: false, error: error.message };
  }
}

// Update driver location
export async function updateDriverLocation(userId, latitude, longitude, speed = 0, heading = 0) {
  try {
    console.log(`[updateDriverLocation] Updating location for ${userId}:`, { latitude, longitude, speed, heading });
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
    console.log(`[updateDriverLocation] Update result:`, result);
    return result;
  } catch (error) {
    console.error('[updateDriverLocation] Error:', error);
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


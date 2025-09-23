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
    console.error('API call failed:', error);
    throw error;
  }
}

// Create ride hailing booking
export async function createRideBooking(bookingData) {
  try {
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
    return result;
  } catch (error) {
    console.error('Error fetching routes by pickup:', error);
    throw error;
  }
}

// Get user's active ride bookings for tracking
export async function getMyActiveRides(customerId) {
  try {
    const result = await apiCall(`/ride-hailing/`);
    // Filter client-side to avoid query parameter issues
    if (result.success && result.data) {
      const activeRides = result.data.filter(ride => 
        ride.customer_id === customerId && 
        ['waiting_for_driver', 'driver_assigned', 'in_progress'].includes(ride.status)
      );
      return { success: true, data: activeRides };
    }
    return result;
  } catch (error) {
    console.error('Error fetching active rides:', error);
    return { success: false, error: error.message };
  }
}

// Get driver location for tracking
export async function getDriverLocation(driverId) {
  try {
    const result = await apiCall('/location/drivers/');
    if (result.success && result.data && result.data.length > 0) {
      const driverLocation = result.data.find(loc => loc.user_id === driverId);
      return driverLocation ? { success: true, data: driverLocation } : { success: false, error: 'Driver location not found' };
    }
    return { success: false, error: 'No location data' };
  } catch (error) {
    console.error('Error fetching driver location:', error);
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
    console.error('Error updating driver location:', error);
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
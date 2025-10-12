import { apiClient } from './improvedApiClient';
import { getCurrentUser } from './authService';

// Legacy request function for backward compatibility
async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const result = await apiClient.makeRequest(path, {
    method,
    headers,
    body: body ? JSON.parse(body) : null,
    timeout: timeoutMs
  });
  
  return {
    ok: result.success,
    status: result.status || 0,
    data: result.data || { success: false, error: result.error }
  };
}

export async function getMyTourPackages() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const result = await apiClient.get('/tourpackage/');
    if (result.success) {
      const packages = result.data?.data || result.data || [];
      // Filter by driver_id
      const myPackages = packages.filter(pkg => pkg.driver_id === user.id);
      return { success: true, data: myPackages };
    }
    return { success: false, error: result.error || 'Failed to fetch my tour packages' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to fetch tour packages' };
  }
}

export async function createTourPackage(packageData) {
  try {
    const user = await getCurrentUser();
    const userRole = user?.role || 'driver';
    const dataWithDriver = {
      ...packageData,
      creator_role: userRole,
      creator_id: user?.id,
      driver_id: user?.id
    };
    
    const result = await apiClient.post('/tourpackage/', dataWithDriver, {
      timeout: 30000,
    });
    if (result.success && (result.data?.success || result.status === 201)) {
      return { success: true, data: result.data?.data || result.data };
    }
    return { success: false, error: result.error || 'Failed to create tour package' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to create tour package' };
  }
}

export async function updateTourPackage(packageId, packageData) {
  const result = await apiClient.put(`/tourpackage/${packageId}/`, packageData, {
    timeout: 30000,
  });
  if (result.success && (result.data?.success || result.status === 200)) {
    return { success: true, data: result.data?.data || result.data };
  }
  return { success: false, error: result.error || 'Failed to update tour package' };
}

export async function togglePackageStatus(packageId) {
  try {
    const user = await getCurrentUser();
    const requestData = {
      driver_id: user?.id // Include driver_id for ownership verification
    };
    
    const result = await apiClient.post(`/tourpackage/${packageId}/toggle_status/`, requestData, {
      timeout: 15000,
    });
    if (result.success && (result.data?.success || result.status === 200)) {
      return { success: true, data: result.data?.data || result.data };
    }
    return { success: false, error: result.error || 'Failed to toggle package status' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to toggle package status' };
  }
}

export async function getPickupPoints() {
  const result = await apiClient.get('/tourpackage/get_pickup_points/');
  if (result.success) {
    const points = result.data?.data || result.data || [];
    return { success: true, data: points };
  }
  return { success: false, error: result.error || 'Failed to fetch pickup points' };
}

export async function getDropoffPoints(pickupId, pickupName) {
  try {
    const params = new URLSearchParams();
    if (pickupId) params.append('pickup_id', pickupId);
    if (pickupName) params.append('pickup_name', pickupName);
    
    const result = await apiClient.get(`/map/dropoff-points/?${params.toString()}`);
    if (result.success) {
      const dropoffPoints = result.data?.data?.dropoff_points || [];
      return { success: true, data: dropoffPoints };
    }
    return { success: false, error: result.error || 'Failed to fetch dropoff points' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to fetch dropoff points' };
  }
}

export async function getPackageBookings(packageId) {
  try {
    const result = await apiClient.get(`/tour-booking/?package_id=${packageId}`);
    if (result.success) {
      const bookings = result.data?.data?.bookings || result.data?.data || [];
      return { success: true, data: bookings };
    }
    return { success: false, error: result.error || 'Failed to fetch package bookings' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to fetch package bookings' };
  }
}

export async function acceptPackageBooking(bookingId) {
  try {
    const user = await getCurrentUser();
    const result = await apiClient.post(`/tour-booking/driver-accept/${bookingId}/`, {
      driver_id: user?.id,
      driver_name: user?.name || user?.email
    });
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error || 'Failed to accept booking' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to accept booking' };
  }
}

export async function getPackageReviews(packageId) {
  try {
    const result = await apiClient.get(`/reviews/?package_id=${packageId}&include_stats=true`);
    if (result.success) {
      const reviews = result.data?.data || [];
      const stats = result.data?.stats || null;
      return { success: true, data: reviews, stats };
    }
    return { success: false, error: result.error || 'Failed to fetch reviews' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to fetch reviews' };
  }
}
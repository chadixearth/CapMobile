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
  const result = await apiClient.post(`/tourpackage/${packageId}/toggle_status/`, null, {
    timeout: 15000,
  });
  if (result.success && (result.data?.success || result.status === 200)) {
    return { success: true, data: result.data?.data || result.data };
  }
  return { success: false, error: result.error || 'Failed to toggle package status' };
}

export async function getPickupPoints() {
  const result = await apiClient.get('/tourpackage/get_pickup_points/');
  if (result.success) {
    const points = result.data?.data || result.data || [];
    return { success: true, data: points };
  }
  return { success: false, error: result.error || 'Failed to fetch pickup points' };
}
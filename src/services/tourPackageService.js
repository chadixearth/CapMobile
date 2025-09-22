import { apiBaseUrl } from './networkConfig';
import { getAccessToken, getCurrentUser } from './authService';

async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, status: 0, data: { success: false, error: 'Request timeout' } };
    }
    return { ok: false, status: 0, data: { success: false, error: error.message || 'Network error' } };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getMyTourPackages() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }
    
    const res = await request('/tourpackage/', { method: 'GET' });
    if (res.ok) {
      const packages = res.data?.data || res.data || [];
      // Filter by driver_id
      const myPackages = packages.filter(pkg => pkg.driver_id === user.id);
      return { success: true, data: myPackages };
    }
    return { success: false, error: res.data?.error || 'Failed to fetch my tour packages' };
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
    
    const res = await request('/tourpackage/', {
      method: 'POST',
      body: JSON.stringify(dataWithDriver),
      timeoutMs: 30000,
    });
    if (res.ok && (res.data?.success || res.status === 201)) {
      return { success: true, data: res.data?.data || res.data };
    }
    return { success: false, error: res.data?.error || 'Failed to create tour package' };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to create tour package' };
  }
}

export async function updateTourPackage(packageId, packageData) {
  const res = await request(`/tourpackage/${packageId}/`, {
    method: 'PUT',
    body: JSON.stringify(packageData),
    timeoutMs: 30000,
  });
  if (res.ok && (res.data?.success || res.status === 200)) {
    return { success: true, data: res.data?.data || res.data };
  }
  return { success: false, error: res.data?.error || 'Failed to update tour package' };
}

export async function togglePackageStatus(packageId) {
  const res = await request(`/tourpackage/${packageId}/toggle_status/`, {
    method: 'POST',
    timeoutMs: 15000,
  });
  if (res.ok && (res.data?.success || res.status === 200)) {
    return { success: true, data: res.data?.data || res.data };
  }
  return { success: false, error: res.data?.error || 'Failed to toggle package status' };
}

export async function getPickupPoints() {
  const res = await request('/tourpackage/get_pickup_points/', { method: 'GET' });
  if (res.ok) {
    const points = res.data?.data || res.data || [];
    return { success: true, data: points };
  }
  return { success: false, error: res.data?.error || 'Failed to fetch pickup points' };
}
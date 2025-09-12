// Reviews API service
// Provides list helpers and submission for package and driver reviews
import { apiBaseUrl } from './networkConfig';
import { getAccessToken } from './authService';

async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
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

export async function listReviews({ package_id, booking_id, reviewer_id, limit = 10, include_stats = false } = {}) {
  try {
    const params = new URLSearchParams();
    if (package_id) params.append('package_id', package_id);
    if (booking_id) params.append('booking_id', booking_id);
    if (reviewer_id) params.append('reviewer_id', reviewer_id);
    if (limit) params.append('limit', String(limit));
    if (include_stats) params.append('include_stats', 'true');

    const qs = params.toString();
    const res = await request(`/package-reviews/${qs ? `?${qs}` : ''}`, { method: 'GET' });

    if (res.ok) {
      // Expected shape: { success: true, data: [...], count, stats? }
      const data = res.data?.data ?? res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      const stats = res.data?.stats || null;
      return { success: true, data: Array.isArray(data) ? data : [], stats };
    }
    return { success: false, error: res.data?.error || 'Failed to fetch reviews' };
  } catch (error) {
    // Handle missing reviews table gracefully
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      return { success: true, data: [], stats: null };
    }
    return { success: false, error: error.message || 'Failed to fetch reviews' };
  }
}

export async function createPackageReview({ package_id, booking_id, reviewer_id, rating, comment = '' }) {
  try {
    const token = await getAccessToken().catch(() => null);
    const res = await request(`/package-reviews/`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ package_id, booking_id, reviewer_id, rating, comment }),
      timeoutMs: 20000,
    });
    if (res.ok && (res.data?.success || res.status === 201)) {
      return { success: true, data: res.data?.data || res.data };
    }
    return { success: false, error: res.data?.error || 'Failed to submit package review' };
  } catch (e) {
    return { success: false, error: e?.message || 'Failed to submit package review' };
  }
}

export async function createDriverReview({ driver_id, booking_id, reviewer_id, rating, comment = '' }) {
  try {
    const token = await getAccessToken().catch(() => null);
    const res = await request(`/reviews/driver/`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ driver_id, booking_id, reviewer_id, rating, comment }),
      timeoutMs: 20000,
    });
    if (res.ok && (res.data?.success || res.status === 201)) {
      return { success: true, data: res.data?.data || res.data };
    }
    return { success: false, error: res.data?.error || 'Failed to submit driver review' };
  } catch (e) {
    return { success: false, error: e?.message || 'Failed to submit driver review' };
  }
}

export async function getDriverReviews({ driver_id, limit = 20 } = {}) {
  if (!driver_id) return { success: false, error: 'driver_id is required' };
  const res = await request(`/reviews/driver/${driver_id}/?limit=${encodeURIComponent(limit)}`, { method: 'GET' });
  if (res.ok) {
    const data = res.data?.data?.reviews || res.data?.data || res.data;
    const stats = res.data?.data && {
      average_rating: res.data?.data?.average_rating,
      review_count: res.data?.data?.review_count,
    };
    return { success: true, data: Array.isArray(data) ? data : [], stats };
  }
  return { success: false, error: res.data?.error || 'Failed to fetch driver reviews' };
}

export async function getUserReviews({ user_id, type = 'received', limit = 50 } = {}) {
  if (!user_id) return { success: false, error: 'user_id is required' };
  
  try {
    if (type === 'received') {
      // Get reviews received by this user (as driver/owner)
      return await getDriverReviews({ driver_id: user_id, limit });
    } else {
      // Get reviews given by this user
      return await listReviews({ reviewer_id: user_id, limit, include_stats: true });
    }
  } catch (error) {
    return { success: false, error: error.message || 'Failed to fetch user reviews' };
  }
}

export async function checkExistingReviews({ booking_id, reviewer_id }) {
  if (!booking_id || !reviewer_id) return { success: false, error: 'booking_id and reviewer_id are required' };
  
  try {
    const res = await request(`/package-reviews/check-existing/${booking_id}/?reviewer_id=${encodeURIComponent(reviewer_id)}`, { method: 'GET' });
    
    if (res.ok && res.data?.success) {
      return {
        success: true,
        data: {
          hasPackageReview: res.data.data.has_package_review,
          hasDriverReview: res.data.data.has_driver_review
        }
      };
    }
    
    return { success: false, error: res.data?.error || 'Failed to check existing reviews' };
  } catch (error) {
    // Handle missing reviews table gracefully
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      return {
        success: true,
        data: {
          hasPackageReview: false,
          hasDriverReview: false
        }
      };
    }
    return { success: false, error: error.message || 'Failed to check existing reviews' };
  }
}


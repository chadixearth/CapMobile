// API Configuration
import { Platform, NativeModules } from 'react-native';
import { apiBaseUrl } from '../networkConfig';
function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}
const API_BASE_URL = `${apiBaseUrl()}/tour-booking/`; 
import { getAccessToken, getCurrentUser } from '../authService';
import { syncUserToBackend } from '../userSync';

export async function createBooking(bookingData) {
  // Defensive: enforce server-expected types and field names
  const sanitizeTime = (timeStr) => {
    if (typeof timeStr !== 'string') return '09:00:00';
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return '09:00:00';
    let h = Math.max(0, Math.min(23, parseInt(match[1], 10) || 0));
    let m = Math.max(0, Math.min(59, parseInt(match[2], 10) || 0));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  // Normalize booking_date to YYYY-MM-DD and set initial status explicitly
  const normalizeDate = (dateInput) => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    try {
      const d = new Date(dateInput);
      if (Number.isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const payload = {
    package_id: bookingData.package_id,
    customer_id: bookingData.customer_id,
    booking_date: normalizeDate(bookingData.booking_date),
    pickup_time: sanitizeTime(bookingData.pickup_time),
    number_of_pax: Number(bookingData.number_of_pax) || 1,
    total_amount: Number(bookingData.total_amount) || 0,
    special_requests: bookingData.special_requests || '',
    contact_number: String(bookingData.contact_number || ''),
    pickup_address: bookingData.pickup_address || '',
    // Ensure new bookings start in a valid state for driver discovery
    status: 'waiting_for_driver',
  };
  const attempt = async (bodyPayload) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Expected JSON but received: ${contentType || 'unknown'}`);
      }

      return await response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

  // Retry up to 3 times on transient errors
  let currentPayload = { ...payload };
  for (let i = 0; i < 3; i += 1) {
    try {
      return await attempt(currentPayload);
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '');
      const isNet = /Network request failed|Failed to fetch|getaddrinfo|ENOTFOUND/i.test(err?.message || '');
      const isStatusCheck = /23514|status_check|bookings_status_check/i.test(err?.message || '');
      const isUserNotFound = /Tourist.*does not exist|Customer.*does not exist/i.test(err?.message || '');
      
      if (isStatusCheck && currentPayload.status === 'waiting_for_driver') {
        // Fallback to a conservative initial status if backend disallows waiting_for_driver at creation
        currentPayload = { ...currentPayload, status: 'pending' };
        console.warn('Backend rejected initial status; retrying with status=pending');
        continue;
      }
      
      if (isUserNotFound && i === 0) {
        // Try to sync user to backend
        try {
          const user = await getCurrentUser();
          if (user) {
            console.log('Attempting to sync user to backend...');
            const syncResult = await syncUserToBackend(user);
            if (syncResult.success) {
              console.log('User synced successfully, retrying booking creation');
              continue;
            }
          }
        } catch (syncError) {
          console.error('Failed to sync user:', syncError);
        }
      }
      
      if (i < 2 && (isAbort || isNet)) {
        await new Promise(res => setTimeout(res, 800));
        continue;
      }
      console.error('Error creating booking:', err);
      throw err;
    }
  }
}

export async function getBookings(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = `${API_BASE_URL}?${queryParams.toString()}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const token = await getAccessToken();
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }
}

export async function getBooking(bookingId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${bookingId}/`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching booking:', error);
    throw error;
  }
}

export async function updateBookingStatus(bookingId, status) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${bookingId}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

export async function cancelBooking(bookingId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${bookingId}/`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error cancelling booking:', error);
    throw error;
  }
}

export async function getBookingByReference(reference) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}reference/${reference}/`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching booking by reference:', error);
    throw error;
  }
}

export async function getCustomerBookings(customerId, filters = {}) {
  const attempt = async (timeoutMs = 25000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const url = `${API_BASE_URL}customer/${customerId}/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      console.log('Fetching customer bookings from:', url);

      const token = await getAccessToken().catch(() => null);
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
      }

      return await response.json();
    } finally {
      // Ensure timer is cleared on any path
      clearTimeout(timeoutId);
    }
  };

  const attemptNoTimeout = async () => {
    // Build query parameters
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });

    const url = `${API_BASE_URL}customer/${customerId}/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('Fetching customer bookings (no-timeout) from:', url);
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response (no-timeout):', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    return await response.json();
  };

  // Retry strategy on Abort/Network errors, with backoff and longer timeout
  for (let i = 0; i < 3; i += 1) {
    try {
      const timeout = i === 0 ? 25000 : i === 1 ? 35000 : 45000;
      const data = await attempt(timeout);
      console.log('Customer bookings response:', data);
      return data;
    } catch (error) {
      const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
      const isNet = /Network request failed|Failed to fetch|getaddrinfo|ENOTFOUND|timeout/i.test(error?.message || '');
      if (isAbort) {
        try {
          // Try once immediately without a timeout controller
          const data = await attemptNoTimeout();
          console.log('Customer bookings response (no-timeout):', data);
          return data;
        } catch (e) {
          // fall through to retry/backoff below
        }
      }
      if (i < 2 && (isAbort || isNet)) {
        await new Promise((res) => setTimeout(res, 800 + i * 600));
        continue;
      }
      console.error('Error fetching customer bookings:', error);
      throw error;
    }
  }
}

export async function getBookingStats() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${API_BASE_URL}stats/`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    throw error;
  }
}

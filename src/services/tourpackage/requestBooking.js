// API Configuration
import { Platform, NativeModules } from 'react-native';
import { buildApiUrl, validateApiUrl } from '../urlValidator';
function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}
const API_BASE_URL = buildApiUrl('/tour-booking/'); 
import { getAccessToken, getCurrentUser } from '../authService';
import { syncUserToBackend } from '../userSync';
import NotificationService from '../notificationService';

// Helper function to create tourist record via sync endpoint
async function createTouristRecord(user) {
  try {
    const token = await getAccessToken();
    const url = buildApiUrl('/auth/sync-user/');
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name || user.email?.split('@')[0] || 'User',
        role: user.role || 'tourist',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result.data || result,
    };
  } catch (error) {
    const isRLSError = error.message?.includes('row-level security policy') || 
                      error.message?.includes('42501');
    
    if (isRLSError) {
      console.log('Tourist record creation blocked by RLS policy');
      return {
        success: false,
        error: 'Tourist record creation blocked by database policy',
        rls_error: true
      };
    }
    
    console.log('Error creating tourist record:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to create tourist record',
    };
  }
}

// Check if driver is available before creating booking
// Note: Always returns available to allow tourists to book
// Backend will handle driver notifications and availability
export async function checkDriverAvailability(packageId, bookingDate, bookingTime) {
  try {
    // Always return available to allow tourists to book
    // The booking system should allow all tourist bookings and let drivers respond
    console.log('Driver availability check - allowing booking to proceed');
    return {
      success: true,
      available: true, // Always return true - tourists can always book
      message: 'Booking allowed - drivers will be notified and can accept or decline'
    };
  } catch (error) {
    console.error('Error in availability check:', error);
    // Even on error, allow booking to proceed
    return {
      success: true,
      available: true, // Still allow booking
      message: 'Booking allowed despite availability check error'
    };
  }
}

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
    // New bookings start as pending until driver accepts
    status: 'pending',
  };
  const attempt = async (bodyPayload, retryCount = 0) => {
    const controller = new AbortController();
    const timeout = Math.min(30000 + (retryCount * 5000), 45000); // Progressive timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const token = await getAccessToken();
      if (!validateApiUrl(API_BASE_URL)) throw new Error('Invalid API URL');
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
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

  // Retry up to 5 times with exponential backoff for socket errors
  let currentPayload = { ...payload };
  for (let i = 0; i < 5; i += 1) {
    try {
      const result = await attempt(currentPayload, i);
      
      // Backend already handles driver notifications
      if (result && result.success && result.data) {
        console.log('[Booking] ✅ Booking created successfully:', result.data.id);
        console.log('[Booking] Backend notification result:', result.notification_result);
      }
      
      return result;
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '');
      const isNet = /Network request failed|Failed to fetch|getaddrinfo|ENOTFOUND/i.test(err?.message || '');
      const isSocketError = /WinError 10035|EWOULDBLOCK|EAGAIN|socket operation could not be completed/i.test(err?.message || '');
      const isStatusCheck = /23514|status_check|bookings_status_check/i.test(err?.message || '');
      const isUserNotFound = /Tourist.*does not exist|Customer.*does not exist/i.test(err?.message || '');
      const isExpiredPackage = /Tour package has expired|cannot be booked/i.test(err?.message || '');
      
      // Don't retry expired package errors - they're business logic
      if (isExpiredPackage) {
        console.log('Booking prevented - package expired');
        throw err;
      }
      
      // Handle availability errors - but allow booking to proceed
      const isAvailabilityError = /not available on|driver not available|schedule not set|Tour package is not available|Driver is not available/i.test(err?.message || '');
      if (isAvailabilityError && i < 2) {
        console.log('Driver availability issue detected, retrying with pending status');
        // Try to force the booking through with pending status
        if (currentPayload.status !== 'pending') {
          currentPayload = { ...currentPayload, status: 'pending' };
          console.log('Retrying booking with pending status despite availability issue');
          continue;
        }
        // If we already tried with pending status twice, stop retrying
        console.log('Already tried with pending status, stopping retries');
      }
      
      if (isStatusCheck && currentPayload.status === 'pending') {
        // If backend rejects pending status, try with waiting_for_driver as fallback
        currentPayload = { ...currentPayload, status: 'waiting_for_driver' };
        console.warn('Backend rejected pending status; retrying with status=waiting_for_driver');
        continue;
      }
      
      if (isUserNotFound && i === 0) {
        // Try to create tourist record directly
        try {
          const user = await getCurrentUser();
          if (user) {
            console.log('Attempting to create tourist record...');
            const createResult = await createTouristRecord(user);
            if (createResult.success) {
              console.log('Tourist record created successfully, retrying booking creation');
              continue;
            } else {
              console.log('Failed to create tourist record, trying user sync...');
              const syncResult = await syncUserToBackend(user);
              if (syncResult.success) {
                console.log('User synced successfully, retrying booking creation');
                continue;
              } else {
                console.log('User sync failed, but continuing with booking attempt...');
                // Don't fail the booking just because user sync failed
                // The backend should handle missing users gracefully
              }
            }
          }
        } catch (syncError) {
          console.log('User sync error (non-blocking):', syncError.message);
          // Continue with booking attempt even if user sync fails
        }
      }
      
      if (i < 4 && (isAbort || isNet || isSocketError)) {
        // Exponential backoff: 1s, 2s, 4s, 8s
        const delay = Math.min(1000 * Math.pow(2, i), 8000);
        console.log(`Retrying booking in ${delay}ms due to ${isSocketError ? 'socket' : 'network'} error...`);
        await new Promise(res => setTimeout(res, delay));
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
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
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
    
    const url = `${API_BASE_URL}${bookingId}/`;
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
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
    console.error('Error fetching booking:', error);
    throw error;
  }
}

export async function updateBookingStatus(bookingId, status) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const url = `${API_BASE_URL}${bookingId}/`;
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
    const token = await getAccessToken();
    const response = await fetch(url, {
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
    
    const url = `${API_BASE_URL}${bookingId}/`;
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
    const token = await getAccessToken();
    const response = await fetch(url, {
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
    
    const url = `${API_BASE_URL}reference/${reference}/`;
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
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
      
      // Always include driver information
      queryParams.append('include_driver', 'true');
      queryParams.append('include_package', 'true');
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const url = `${API_BASE_URL}customer/${customerId}/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      if (!validateApiUrl(url)) throw new Error('Invalid API URL');
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
    
    // Always include driver information
    queryParams.append('include_driver', 'true');
    queryParams.append('include_package', 'true');
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });

    const url = `${API_BASE_URL}customer/${customerId}/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
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
    
    const url = `${API_BASE_URL}stats/`;
    if (!validateApiUrl(url)) throw new Error('Invalid API URL');
    const response = await fetch(url, {
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

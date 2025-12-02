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
const API_BASE_URL = apiBaseUrl();

/**
 * Helper function to make API requests with proper error handling
 */
async function apiRequest(endpoint, options = {}) {
  const attemptRequest = async (timeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // Safely parse JSON
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: 'Invalid JSON response' };
      }
      return { response, data };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    const { response, data } = await attemptRequest(30000);
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    if (error.name === 'AbortError') {
      // One retry with longer timeout
      try {
        const { response, data } = await attemptRequest(45000);
        return { success: response.ok, data, status: response.status };
      } catch (retryError) {
        if (retryError.name === 'AbortError') {
          return { success: false, error: 'Request timeout. Please try again.' };
        }
        return { success: false, error: retryError.message || 'Network error occurred' };
      }
    }
    return { success: false, error: error.message || 'Network error occurred' };
  }
}

/**
 * Create a new custom tour package request
 * @param {Object} customTourData - Custom tour request data
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createCustomTourRequest(customTourData) {
  try {
    // Map the mobile app fields to match backend expectations
    const requestData = {
      customer_id: customTourData.customer_id,
      destination: customTourData.destination,
      pickup_location: customTourData.pickup_location || '',
      preferred_duration_hours: customTourData.preferred_duration_hours || 0,
      preferred_duration_minutes: customTourData.preferred_duration_minutes || 0,
      number_of_pax: customTourData.number_of_pax,
      preferred_date: customTourData.preferred_date,
      special_requests: customTourData.special_requests || '',
      contact_number: customTourData.contact_number,
      contact_email: customTourData.contact_email || ''
    };

    const result = await apiRequest('/custom-tour-requests/', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    if (result.success && result.data.success) {
      return {
        success: true,
        data: result.data.data,
        message: result.data.message,
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to create custom tour request',
    };
  } catch (error) {
    console.error('Error creating custom tour request:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Create a new special event request
 * @param {Object} specialEventData - Special event request data
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function createSpecialEventRequest(specialEventData) {
  try {
    // Map the mobile app fields to match backend expectations
    const requestData = {
      customer_id: specialEventData.customer_id,
      event_type: specialEventData.event_type,
      event_date: specialEventData.event_date,
      event_time: specialEventData.event_time,
      event_address: specialEventData.pickup_location, // Map pickup_location to event_address
      number_of_pax: specialEventData.number_of_pax,
      special_requirements: specialEventData.special_requirements || '',
      contact_number: specialEventData.contact_number,
      contact_email: specialEventData.contact_email || ''
    };

    const result = await apiRequest('/special-event-requests/', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });

    if (result.success && result.data.success) {
      // Notify all owners about the new special event
      try {
        const NotificationService = (await import('../notificationService')).default;
        await NotificationService.notifyOwnersOfNewSpecialEvent({
          ...result.data.data,
          customer_name: specialEventData.customer_name || 'Customer'
        });
      } catch (notifError) {
        console.warn('Failed to send owner notifications:', notifError);
      }
      
      return {
        success: true,
        data: result.data.data,
        message: result.data.message,
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to create special event request',
    };
  } catch (error) {
    console.error('Error creating special event request:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Get custom package requests for a specific customer
 * @param {string} customerId - Customer's user ID
 * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
 */
export async function getCustomerCustomRequests(customerId) {
  try {
    // Fetch both custom tour requests and special event requests
    const [tourResult, eventResult] = await Promise.all([
      apiRequest(`/custom-tour-requests/?customer_id=${customerId}`, {
        method: 'GET',
      }),
      apiRequest(`/special-event-requests/?customer_id=${customerId}`, {
        method: 'GET',
      })
    ]);

    let allRequests = [];

    // Process custom tour requests
    if (tourResult.success && tourResult.data.success) {
      const tourRequests = tourResult.data.data || [];
      // Add request_type field for UI identification
      allRequests = allRequests.concat(
        tourRequests.map(req => ({ ...req, request_type: 'custom_tour' }))
      );
    }

    // Process special event requests
    if (eventResult.success && eventResult.data.success) {
      const eventRequests = eventResult.data.data || [];
      // Add request_type field for UI identification
      allRequests = allRequests.concat(
        eventRequests.map(req => ({ ...req, request_type: 'special_event' }))
      );
    }

    // Sort by created_at date (most recent first)
    allRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      success: true,
      data: allRequests,
      count: allRequests.length,
    };
  } catch (error) {
    console.error('Error fetching custom requests:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Get all custom package requests (for admin use)
 * @param {Object} filters - Optional filters
 * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
 */
export async function getAllCustomRequests(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (filters.status) {
      queryParams.append('status', filters.status);
    }
    
    const queryString = queryParams.toString();
    
    // If specific request type is requested, fetch only that type
    if (filters.request_type === 'custom_tour') {
      const endpoint = queryString ? `/custom-tour-requests/?${queryString}` : '/custom-tour-requests/';
      const result = await apiRequest(endpoint, { method: 'GET' });
      
      if (result.success && result.data.success) {
        const requests = result.data.data || [];
        return {
          success: true,
          data: requests.map(req => ({ ...req, request_type: 'custom_tour' })),
          count: requests.length,
        };
      }
    } else if (filters.request_type === 'special_event') {
      const endpoint = queryString ? `/special-event-requests/?${queryString}` : '/special-event-requests/';
      const result = await apiRequest(endpoint, { method: 'GET' });
      
      if (result.success && result.data.success) {
        const requests = result.data.data || [];
        return {
          success: true,
          data: requests.map(req => ({ ...req, request_type: 'special_event' })),
          count: requests.length,
        };
      }
    } else {
      // Fetch both types
      const tourEndpoint = queryString ? `/custom-tour-requests/?${queryString}` : '/custom-tour-requests/';
      const eventEndpoint = queryString ? `/special-event-requests/?${queryString}` : '/special-event-requests/';
      
      const [tourResult, eventResult] = await Promise.all([
        apiRequest(tourEndpoint, { method: 'GET' }),
        apiRequest(eventEndpoint, { method: 'GET' })
      ]);

      let allRequests = [];

      if (tourResult.success && tourResult.data.success) {
        const tourRequests = tourResult.data.data || [];
        allRequests = allRequests.concat(
          tourRequests.map(req => ({ ...req, request_type: 'custom_tour' }))
        );
      }

      if (eventResult.success && eventResult.data.success) {
        const eventRequests = eventResult.data.data || [];
        allRequests = allRequests.concat(
          eventRequests.map(req => ({ ...req, request_type: 'special_event' }))
        );
      }

      // Sort by created_at date
      allRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        success: true,
        data: allRequests,
        count: allRequests.length,
      };
    }

    return {
      success: false,
      error: 'Failed to fetch custom requests',
    };
  } catch (error) {
    console.error('Error fetching all custom requests:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Get a specific custom package request by ID
 * @param {string} requestId - Request ID
 * @param {string} requestType - 'custom_tour' or 'special_event'
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function getCustomRequestById(requestId, requestType) {
  try {
    const endpoint = requestType === 'special_event' 
      ? `/special-event-requests/${requestId}/`
      : `/custom-tour-requests/${requestId}/`;
    
    const result = await apiRequest(endpoint, {
      method: 'GET',
    });

    if (result.success && result.data.success) {
      return {
        success: true,
        data: { ...result.data.data, request_type: requestType },
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Custom request not found',
    };
  } catch (error) {
    console.error('Error fetching custom request:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Update custom package request status (admin only)
 * @param {string} requestId - Request ID
 * @param {string} requestType - 'custom_tour' or 'special_event'
 * @param {Object} updateData - Data to update (status, admin_response)
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateCustomRequestStatus(requestId, requestType, updateData) {
  try {
    const endpoint = requestType === 'special_event' 
      ? `/special-event-requests/${requestId}/`
      : `/custom-tour-requests/${requestId}/`;
    
    const result = await apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });

    if (result.success && result.data.success) {
      return {
        success: true,
        data: result.data.data,
        message: result.data.message,
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to update custom request',
    };
  } catch (error) {
    console.error('Error updating custom request:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Get custom tour requests available for drivers to accept
 * @param {string} [driverId] - Optional driver ID to let backend filter out requests accepted by others
 * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
 */
export async function getAvailableCustomTourRequestsForDrivers(driverId) {
  try {
    const endpoint = driverId
      ? `/custom-tour-requests/available-for-drivers/?driver_id=${encodeURIComponent(driverId)}`
      : '/custom-tour-requests/available-for-drivers/';
    const result = await apiRequest(endpoint, {
      method: 'GET',
    });

    if (result.success && result.data.success) {
      const requests = result.data.data || [];
      return {
        success: true,
        data: requests.map(req => ({ ...req, request_type: 'custom_tour' })),
        count: requests.length,
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to fetch available custom tour requests',
    };
  } catch (error) {
    console.error('Error fetching available custom tour requests for drivers:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Driver accepts a custom tour request
 * @param {string} requestId - Custom tour request ID
 * @param {Object} driverData - Driver information
 * @param {string} driverData.driver_id - Driver's ID
 * @param {string} driverData.driver_name - Driver's name
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function driverAcceptCustomTourRequest(requestId, driverData) {
  try {
    const result = await apiRequest(`/custom-tour-requests/driver-accept/${requestId}/`, {
      method: 'POST',
      body: JSON.stringify(driverData),
    });

    if (result.success && result.data.success) {
      return {
        success: true,
        data: result.data.data,
        message: result.data.message,
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to accept custom tour request',
    };
  } catch (error) {
    console.error('Error accepting custom tour request:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Get custom tour requests assigned to a specific driver
 * @param {string} driverId - Driver's user ID
 * @param {Object} filters - Optional filters (e.g., status)
 * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
 */
export async function getDriverCustomTours(driverId, filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('driver_id', driverId);
    Object.keys(filters).forEach((key) => {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });

    const result = await apiRequest(`/custom-tour-requests/?${queryParams.toString()}`, {
      method: 'GET',
    });

    if (result.success && result.data && (Array.isArray(result.data) || result.data.success)) {
      const list = Array.isArray(result.data)
        ? result.data
        : (result.data.data || []);
      return {
        success: true,
        data: list.map((req) => ({ ...req, request_type: 'custom_tour' })),
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to fetch driver custom tours',
    };
  } catch (error) {
    console.error('Error fetching driver custom tours:', error);
    return { success: false, error: error.message || 'Network error occurred' };
  }
}

/**
 * Update custom tour request status (driver flow)
 * @param {string} requestId
 * @param {string} status - e.g., 'in_progress' | 'completed'
 */
export async function updateCustomTourStatus(requestId, status) {
  try {
    const result = await apiRequest(`/custom-tour-requests/${requestId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    if (result.success && (result.data?.success || result.status === 200)) {
      const data = Array.isArray(result.data) ? result.data[0] : (result.data?.data || result.data);
      return { success: true, data };
    }
    return { success: false, error: result.data?.error || 'Failed to update custom tour status' };
  } catch (error) {
    console.error('Error updating custom tour status:', error);
    return { success: false, error: error.message || 'Network error occurred' };
  }
}

/**
 * Get special event requests available for owners to accept
 * @returns {Promise<{ success: boolean, data?: array, error?: string }>}
 */
export async function getAvailableSpecialEventRequestsForOwners() {
  try {
    console.log('🌐 Service: Calling /special-event-requests/available-for-owners/');
    const result = await apiRequest('/special-event-requests/available-for-owners/', {
      method: 'GET',
    });

    console.log('🔍 Service: Raw API result:', JSON.stringify(result, null, 2));

    if (result.success && result.data.success) {
      const requests = result.data.data || [];
      console.log(`✅ Service: Processing ${requests.length} special event requests`);
      
      const processedRequests = requests.map(req => ({ ...req, request_type: 'special_event' }));
      console.log('📋 Service: First request sample:', JSON.stringify(processedRequests[0], null, 2));
      
      return {
        success: true,
        data: processedRequests,
        count: processedRequests.length,
      };
    }

    console.log('❌ Service: API call failed or returned unsuccessful response');
    console.log('📋 Service: Result success:', result.success);
    console.log('📋 Service: Data success:', result.data?.success);
    console.log('📋 Service: Error:', result.data?.error || result.error);

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to fetch available special event requests',
    };
  } catch (error) {
    console.error('💥 Service: Error fetching available special event requests for owners:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

/**
 * Owner accepts a special event request
 * @param {string} requestId - Special event request ID
 * @param {Object} ownerData - Owner information
 * @param {string} ownerData.owner_id - Owner's ID
 * @param {string} ownerData.owner_name - Owner's name
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function ownerAcceptSpecialEventRequest(requestId, ownerData) {
  try {
    const result = await apiRequest(`/special-event-requests/owner-accept/${requestId}/`, {
      method: 'POST',
      body: JSON.stringify(ownerData),
    });

    if (result.success && result.data.success) {
      return {
        success: true,
        data: result.data.data,
        message: result.data.message,
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to accept special event request',
    };
  } catch (error) {
    console.error('Error accepting special event request:', error);
    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}
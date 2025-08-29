import { apiBaseUrl } from './networkConfig';

// API Configuration
const API_BASE_URL = apiBaseUrl();

/**
 * Helper function to make API requests with proper error handling
 */
async function apiRequest(endpoint, options = {}) {
  try {
    console.log(`Making API request to: ${API_BASE_URL}${endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    console.log(`API response status: ${response.status}`);
    
    return {
      success: response.ok,
      data,
      status: response.status,
    };
  } catch (error) {
    console.error('API request error:', error);
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timeout. Please try again.' };
    }
    
    return { success: false, error: error.message || 'Network error occurred' };
  }
}

/**
 * Request account deletion for a user
 * @param {string} userId
 * @param {string} reason - Optional reason for deletion
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function requestAccountDeletion(userId, reason = null) {
  const result = await apiRequest('/auth/request-deletion/', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      reason: reason,
    }),
  });

  if (result.success && result.data.success) {
    return {
      success: true,
      message: result.data.message,
      request_id: result.data.request_id,
      scheduled_deletion_at: result.data.scheduled_deletion_at,
      days_remaining: result.data.days_remaining,
      account_suspended: result.data.account_suspended,
      logout_required: result.data.logout_required,
    };
  }

  return {
    success: false,
    error: result.data?.error || result.error || 'Failed to request account deletion',
  };
}

/**
 * Cancel account deletion request
 * @param {string} userId
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function cancelAccountDeletion(userId) {
  const result = await apiRequest('/auth/cancel-deletion/', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
    }),
  });

  if (result.success && result.data.success) {
    return {
      success: true,
      message: result.data.message,
      account_reactivated: result.data.account_reactivated,
    };
  }

  return {
    success: false,
    error: result.data?.error || result.error || 'Failed to cancel account deletion',
  };
}

/**
 * Get user's account deletion status
 * @param {string} userId
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function getUserDeletionStatus(userId) {
  const result = await apiRequest(`/auth/deletion-status/?user_id=${userId}`, {
    method: 'GET',
  });

  if (result.success && result.data.success) {
    return {
      success: true,
      data: result.data.data,
    };
  }

  return {
    success: false,
    error: result.data?.error || result.error || 'Failed to get deletion status',
  };
}

/**
 * Cancel deletion and login when account is suspended
 * @param {string} userId
 * @param {boolean} confirmCancellation
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function cancelDeletionAndLogin(userId, confirmCancellation = false) {
  const result = await apiRequest('/auth/cancel-deletion-and-login/', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      confirm_cancellation: confirmCancellation,
    }),
  });

  if (result.success && result.data.success) {
    return {
      success: true,
      message: result.data.message,
      account_reactivated: result.data.account_reactivated,
      can_login: result.data.can_login,
      deletion_info: result.data.deletion_info,
      requires_confirmation: result.data.requires_confirmation,
    };
  }

  return {
    success: false,
    error: result.data?.error || result.error || 'Failed to cancel deletion',
  };
}
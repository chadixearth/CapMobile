import { apiRequest } from './authService';
import { getCurrentUser } from './authService';

/**
 * Switch user role between driver and owner
 * @param {string} newRole - New role to switch to (driver, owner, or driver-owner)
 * @returns {Promise<{ success: boolean, message?: string, user?: object, error?: string }>}
 */
export async function switchRole(newRole) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    const result = await apiRequest('/auth/switch-role/', {
      method: 'POST',
      body: JSON.stringify({
        user_id: currentUser.id,
        new_role: newRole
      })
    });

    if (result.success && result.data?.success) {
      return {
        success: true,
        message: result.data.message,
        previous_role: result.data.previous_role,
        new_role: result.data.new_role,
        user: result.data.user
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to switch role'
    };
  } catch (error) {
    console.error('switchRole error:', error);
    return {
      success: false,
      error: error.message || 'Failed to switch role'
    };
  }
}

/**
 * Get available roles user can switch to
 * @returns {Promise<{ success: boolean, current_role?: string, available_roles?: string[], error?: string }>}
 */
export async function getAvailableRoles() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    const result = await apiRequest(`/auth/available-roles/?user_id=${currentUser.id}`, {
      method: 'GET'
    });

    if (result.success && result.data?.success) {
      return {
        success: true,
        current_role: result.data.current_role,
        available_roles: result.data.available_roles || []
      };
    }

    return {
      success: false,
      error: result.data?.error || result.error || 'Failed to get available roles'
    };
  } catch (error) {
    console.error('getAvailableRoles error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get available roles'
    };
  }
}

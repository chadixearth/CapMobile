import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { apiBaseUrl } from './networkConfig';

// API Configuration - Use the network config
const API_BASE_URL = apiBaseUrl();

// Session keys for AsyncStorage
const SESSION_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
};

// Global session expiry handler
let sessionExpiredCallback = null;

export function setSessionExpiredCallback(callback) {
  sessionExpiredCallback = callback;
}

/**
 * Helper function to make API requests with proper error handling
 */
async function apiRequest(endpoint, options = {}) {
  try {
    console.log(`[authService] Making API request to: ${API_BASE_URL}${endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Get auth token for all requests except login/register
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Only add auth token for non-auth endpoints
    const isAuthEndpoint = endpoint.includes('/auth/login') || 
                          endpoint.includes('/auth/register') || 
                          endpoint.includes('/auth/logout');
    
    if (!isAuthEndpoint) {
      const token = await getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        console.log(`[authService] Added auth token to request`);
      }
    } else {
      console.log(`[authService] Skipping auth token for auth endpoint: ${endpoint}`);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Session expiry handled by UnifiedAuth only
    // No session handling in authService
    
    const data = await response.json();
    
    console.log(`API response status: ${response.status}`);
    if (!response.ok) {
      console.log(`API error response:`, data);
    }
    
    return {
      success: response.ok,
      data,
      status: response.status,
    };
  } catch (error) {
    console.error('API request error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Connection timeout. Check if backend server is running on http://192.168.158.63:8000' };
    }
    
    // Check for specific network errors
    if (error.message.includes('getaddrinfo failed') || error.message.includes('ENOTFOUND') || error.message.includes('Network request failed')) {
      return {
        success: false,
        error: `Cannot connect to server at ${API_BASE_URL}. Please check:\n1. Backend server is running\n2. Device is on same network\n3. IP address is correct\n4. Try updating IP in networkConfig.js` 
      };
    }
    
    return { success: false, error: error.message || 'Network error occurred' };
  }
}

/**
 * Store session data in AsyncStorage
 */
async function storeSession(sessionData) {
  try {
    if (sessionData.access_token) {
      await AsyncStorage.setItem(SESSION_KEYS.ACCESS_TOKEN, sessionData.access_token);
    }
    if (sessionData.refresh_token) {
      await AsyncStorage.setItem(SESSION_KEYS.REFRESH_TOKEN, sessionData.refresh_token);
    }
    if (sessionData.user) {
      await AsyncStorage.setItem(SESSION_KEYS.USER_DATA, JSON.stringify(sessionData.user));
    }
  } catch (error) {
    console.error('Error storing session:', error);
  }
}

/**
 * Get stored session data from AsyncStorage
 */
async function getStoredSession() {
  try {
    const accessToken = await AsyncStorage.getItem(SESSION_KEYS.ACCESS_TOKEN);
    const refreshToken = await AsyncStorage.getItem(SESSION_KEYS.REFRESH_TOKEN);
    const userData = await AsyncStorage.getItem(SESSION_KEYS.USER_DATA);
    
    return {
      accessToken,
      refreshToken,
      user: userData ? JSON.parse(userData) : null,
    };
  } catch (error) {
    console.error('Error getting stored session:', error);
    return { accessToken: null, refreshToken: null, user: null };
  }
}

/**
 * Clear stored session data
 */
async function clearStoredSession() {
  try {
    await AsyncStorage.multiRemove([
      SESSION_KEYS.ACCESS_TOKEN,
      SESSION_KEYS.REFRESH_TOKEN,
      SESSION_KEYS.USER_DATA,
    ]);
  } catch (error) {
    console.error('Error clearing stored session:', error);
  }
}

// Expose a safe helper for other modules (does not call network)
export async function clearLocalSession() {
  await clearStoredSession();
}

/**
 * Register a new user with email, password, and role
 * Supports roles: tourist, driver, owner (admin is web-only)
 * @param {string} email
 * @param {string|null} password - Required for tourists, optional for driver/owner (will be generated if null)
 * @param {string} role - Must be one of: tourist, driver, owner
 * @param {object} additionalData - Optional additional user data
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function registerUser(email, password, role, additionalData = {}) {
  // Validate role for mobile app (no admin)
  const validMobileRoles = ['tourist', 'driver', 'owner'];
  if (!validMobileRoles.includes(role)) {
    return {
      success: false,
      error: `Invalid role. Mobile app supports: ${validMobileRoles.join(', ')}`,
    };
  }

  // Password validation
  if (role === 'tourist' && (!password || password.trim() === '')) {
    return {
      success: false,
      error: 'Password is required for tourist registration.',
    };
  }

  // Make direct fetch request to avoid token issues
  const result = await fetch(`${API_BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: password && password.trim() !== '' ? password : null,
      role,
      additional_data: additionalData,
    }),
  });
  
  const data = await result.json();
  const apiResult = {
    success: result.ok,
    data,
    status: result.status,
  };

  if (apiResult.success && apiResult.data.success) {
    return {
      success: true,
      user: apiResult.data.user,
      message: apiResult.data.message,
      status: apiResult.data.status, // Could be 'pending_approval' for driver/owner
      registration_id: apiResult.data.registration_id, // For pending registrations
    };
  }

  return {
    success: false,
    error: apiResult.data?.error || 'Registration failed',
  };
}

/**
 * Login user with email and password
 * @param {string} email
 * @param {string} password
 * @param {string[]} allowedRoles - Optional array of allowed roles
 * @returns {Promise<{ success: boolean, user?: object, session?: object, error?: string }>}
 */
export async function loginUser(email, password, allowedRoles = null) {
  console.log('[authService] loginUser called with:', { email, allowedRoles });
  
  // Clear any existing session before login attempt
  await clearStoredSession();
  console.log('[authService] Cleared existing session before login');
  
  // Make direct fetch request to avoid token issues
  const result = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      allowed_roles: allowedRoles,
    }),
  });
  
  const data = await result.json();
  const apiResult = {
    success: result.ok,
    data,
    status: result.status,
  };
  
  console.log('[authService] API result:', apiResult);

  if (apiResult.success && apiResult.data.success) {
    // Store session data with proper token handling
    const sessionData = {
      access_token: apiResult.data.session?.access_token || apiResult.data.jwt?.token,
      refresh_token: apiResult.data.session?.refresh_token || apiResult.data.jwt?.refresh_token,
      user: apiResult.data.user,
    };
    await storeSession(sessionData);
    console.log('[authService] Session stored with token:', sessionData.access_token ? 'YES' : 'NO');

    // Log deletion cancellation if it occurred
    if (apiResult.data.deletion_cancelled) {
      console.log('[authService] Account deletion was automatically cancelled on login');
    }

    return {
      success: true,
      user: apiResult.data.user,
      session: apiResult.data.session,
      message: apiResult.data.message,
      deletion_cancelled: apiResult.data.deletion_cancelled,
      account_reactivated: apiResult.data.account_reactivated,
      deletion_info: apiResult.data.deletion_info,
    };
  }

  // Handle account scheduled for deletion
  if (apiResult.data?.scheduled_for_deletion) {
    return {
      success: false,
      scheduled_for_deletion: true,
      deletion_info: apiResult.data.deletion_info,
      days_remaining: apiResult.data.days_remaining,
      scheduled_deletion_at: apiResult.data.scheduled_deletion_at,
      error: apiResult.data.error || 'Account is scheduled for deletion',
    };
  }

  // Handle suspension and other specific error cases
  if (apiResult.data?.suspended) {
    return {
      success: false,
      suspended: true,
      suspensionReason: apiResult.data.suspension_reason || 'Account suspended',
      suspensionDays: apiResult.data.suspension_days || 0,
      suspensionEndDate: apiResult.data.suspension_end_date,
      error: `Account suspended: ${apiResult.data.suspension_reason || 'Violation of terms'}${apiResult.data.suspension_days ? ` (${apiResult.data.suspension_days} days remaining)` : ''}`,
    };
  }

  return {
    success: false,
    error: apiResult.data?.error || 'Login failed',
  };
}

/**
 * Logout current user
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function logoutUser() {
  const result = await apiRequest('/auth/logout/', {
    method: 'POST',
  });

  // Clear stored session regardless of API response
  await clearStoredSession();

  if (result.success && result.data.success) {
    return {
      success: true,
      message: result.data.message,
    };
  }

  // Even if API call fails, we consider logout successful if we cleared local data
  return {
    success: true,
    message: 'Logged out successfully',
  };
}

/**
 * Get user profile by user ID
 * @param {string} userId
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function getUserProfile(userId) {
  // Since /auth/profile/ endpoint doesn't exist, return a graceful fallback
  // Using local session data instead of making a backend call
  try {
    const session = await getStoredSession();
    
    if (session.user && session.user.id === userId) {
      return {
        success: true,
        data: session.user,
      };
    } else {
      return {
        success: false,
        error: 'User profile not found in local session',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to get user profile from local session',
    };
  }
}

/**
 * Check if user is logged in by verifying stored session
 * @returns {Promise<{ isLoggedIn: boolean, user?: object }>}
 */
export async function checkAuthStatus() {
  try {
    const session = await getStoredSession();
    
    if (!session.accessToken || !session.user) {
      return {
        isLoggedIn: false,
        user: null,
        accessToken: null,
      };
    }

    // Basic validation - check if token and user data exist and are not empty
    const tokenValid = session.accessToken && session.accessToken.length > 10;
    const userValid = session.user && session.user.id;
    
    if (tokenValid && userValid) {
      return {
        isLoggedIn: true,
        user: session.user,
        accessToken: session.accessToken,
      };
    } else {
      // Invalid session data, clear it
      await clearStoredSession();
      return {
        isLoggedIn: false,
        user: null,
        accessToken: null,
      };
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    return {
      isLoggedIn: false,
      user: null,
      accessToken: null,
    };
  }
}

/**
 * Validate current session with backend
 * @returns {Promise<{ valid: boolean, user?: object }>}
 */
export async function validateSession() {
  try {
    const session = await getStoredSession();
    
    if (!session.accessToken || !session.user) {
      return { valid: false };
    }

    // Use the auth profile endpoint that actually exists (as shown in the Django URL list)
    const result = await apiRequest('/auth/profile/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (result.success && result.status === 200) {
      return {
        valid: true,
        user: result.data || session.user,
      };
    } else if (result.status === 401 || result.status === 403) {
      // Session is invalid, clear it
      console.log('Session invalid - 401/403 received on auth test');
      await clearStoredSession();
      return { valid: false };
    } else {
      // For other errors (like 404), assume session is still valid
      // This prevents false session expiry when endpoints aren't implemented
      console.warn('Session validation failed with non-auth error:', result.status, result.error);
      return {
        valid: true,
        user: session.user,
      };
    }
  } catch (error) {
    console.error('Session validation failed:', error);
    
    // Only clear session if it's an authentication error
    if (error.message?.includes('401') || error.message?.includes('403')) {
      await clearStoredSession();
      return { valid: false };
    }
    
    // For network errors or other issues, assume session is still valid
    const session = await getStoredSession();
    return {
      valid: session.accessToken && session.user ? true : false,
      user: session.user,
    };
  }
}

/**
 * Get current user data from stored session
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  const session = await getStoredSession();
  return session.user;
}

/**
 * Get current access token from stored session
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  try {
    const session = await getStoredSession();
    return session.accessToken || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Update user profile information
 * @param {string} userId
 * @param {object} profileData - Profile data to update
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateUserProfile(userId, profileData) {
  try {
    console.log('[authService] Updating user profile:', { userId, profileData });
    console.log('[authService] API URL:', `${API_BASE_URL}/auth/profile/update/`);
    
    // Clean profile data - remove empty values
    const cleanedData = {};
    Object.keys(profileData).forEach(key => {
      const value = profileData[key];
      if (value !== null && value !== undefined && value !== '') {
        cleanedData[key] = value;
      }
    });
    
    console.log('[authService] Cleaned profile data:', cleanedData);
    
    const requestBody = {
      user_id: userId,
      profile_data: cleanedData
    };
    
    console.log('[authService] Request body:', requestBody);
    
    const result = await apiRequest(`/auth/profile/update/`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });
    
    console.log(`[authService] API response:`, {
      success: result.success,
      status: result.status,
      data: result.data
    });
    
    if (result.success && result.data && result.data.success) {
      // Update local session with new data
      try {
        const session = await getStoredSession();
        if (session.user) {
          const updatedUser = { ...session.user, ...cleanedData };
          await storeSession({
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            user: updatedUser
          });
          console.log('[authService] Local session updated successfully');
        }
      } catch (sessionError) {
        console.warn('Failed to update local session:', sessionError);
      }
      
      return {
        success: true,
        data: result.data.data || result.data.user,
        message: result.data.message || 'Profile updated successfully'
      };
    }
    
    console.log(`[authService] Profile update failed:`, {
      resultSuccess: result.success,
      dataSuccess: result.data?.success,
      error: result.data?.error || result.error,
      status: result.status
    });
    
    return {
      success: false,
      error: result.data?.error || result.error || `Failed to update profile (Status: ${result.status})`
    };
  } catch (error) {
    console.error('updateUserProfile error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update profile'
    };
  }
}

/**
 * Upload profile photo
 * @param {string} userId
 * @param {string} photoUri - URI of the photo to upload
 * @returns {Promise<{ success: boolean, photoUrl?: string, error?: string }>}
 */
export async function uploadProfilePhoto(userId, photoUri) {
  try {
    console.log('uploadProfilePhoto called with:', { userId, photoUri: photoUri.substring(0, 50) + '...' });
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('user_id', userId);
    
    // Handle different platforms
    if (photoUri.startsWith('data:')) {
      // Data URI (web)
      console.log('Handling data URI for web');
      const response = await fetch(photoUri);
      const blob = await response.blob();
      formData.append('photo', blob, 'profile.jpg');
    } else {
      // File URI (mobile)
      console.log('Handling file URI for mobile');
      const fileExtension = photoUri.split('.').pop() || 'jpg';
      const fileName = `profile.${fileExtension}`;
      
      // For React Native, we need to format the file object correctly
      formData.append('photo', {
        uri: photoUri,
        type: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
        name: fileName,
      });
    }

    console.log('Sending request to:', `${API_BASE_URL}/upload/profile-photo/`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for uploads

    // Note: Don't set Content-Type header when using FormData - let the browser/RN set it
    const response = await fetch(`${API_BASE_URL}/upload/profile-photo/`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    console.log('Upload response status:', response.status);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('Non-JSON response:', text);
      data = { error: `Server returned non-JSON response: ${text}` };
    }
    
    console.log('Upload response data:', data);

    if (response.ok && data.success) {
      const photoUrl = data.photo_url || data.photoUrl;
      
      // Update local session with new photo URL
      try {
        const session = await getStoredSession();
        if (session.user) {
          const updatedUser = {
            ...session.user,
            profile_photo: photoUrl,
            profile_photo_url: photoUrl
          };
          await storeSession({
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            user: updatedUser
          });
          console.log('Local session updated with new photo URL');
        }
      } catch (sessionError) {
        console.warn('Failed to update local session:', sessionError);
      }
      
      return {
        success: true,
        photoUrl,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    console.error('uploadProfilePhoto error:', error);
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Upload timeout. Please try again.' };
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to upload photo',
    };
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use registerUser instead
 */
export async function createAccountWithEmail(email, password, role) {
  const result = await registerUser(email, password, role);
  
  // Transform to match legacy format
  if (result.success) {
    return { user: result.user, error: null };
  } else {
    return { user: null, error: { message: result.error } };
  }
}
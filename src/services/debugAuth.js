/**
 * Debug utilities for authentication issues
 * Use these functions to troubleshoot session problems
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAuthStatus, validateSession, getCurrentUser, getAccessToken } from './authService';
import { wasSessionExpiredFlagSet, clearSessionExpiredFlag } from './fetchInterceptor';

/**
 * Print comprehensive auth debug information
 */
export async function debugAuthStatus() {
  console.log('=== AUTH DEBUG INFO ===');
  
  try {
    // Check raw AsyncStorage values
    const rawToken = await AsyncStorage.getItem('access_token');
    const rawRefreshToken = await AsyncStorage.getItem('refresh_token');
    const rawUserData = await AsyncStorage.getItem('user_data');
    const sessionExpiredFlag = await wasSessionExpiredFlagSet();
    
    console.log('Raw AsyncStorage:');
    console.log('- access_token exists:', !!rawToken);
    console.log('- access_token length:', rawToken?.length || 0);
    console.log('- refresh_token exists:', !!rawRefreshToken);
    console.log('- user_data exists:', !!rawUserData);
    console.log('- session_expired_flag:', sessionExpiredFlag);
    
    if (rawUserData) {
      try {
        const userData = JSON.parse(rawUserData);
        console.log('- user_data parsed:', { id: userData.id, email: userData.email, role: userData.role });
      } catch (e) {
        console.log('- user_data parse error:', e.message);
      }
    }
    
    // Check authService functions
    console.log('\nAuth Service Results:');
    const authStatus = await checkAuthStatus();
    console.log('- checkAuthStatus:', { 
      isLoggedIn: authStatus.isLoggedIn, 
      hasUser: !!authStatus.user,
      userRole: authStatus.user?.role 
    });
    
    const currentUser = await getCurrentUser();
    console.log('- getCurrentUser:', { 
      exists: !!currentUser, 
      id: currentUser?.id,
      email: currentUser?.email 
    });
    
    const accessToken = await getAccessToken();
    console.log('- getAccessToken exists:', !!accessToken);
    
    // Optional: Try backend validation (only if needed)
    console.log('\nTrying backend validation...');
    try {
      const validation = await validateSession();
      console.log('- validateSession:', { 
        valid: validation.valid, 
        hasUser: !!validation.user 
      });
    } catch (error) {
      console.log('- validateSession error:', error.message);
    }
    
  } catch (error) {
    console.error('Debug auth status error:', error);
  }
  
  console.log('=== END AUTH DEBUG ===');
}

/**
 * Clear all auth data (for testing)
 */
export async function clearAllAuthData() {
  try {
    await AsyncStorage.multiRemove([
      'access_token',
      'refresh_token', 
      'user_data',
      'authToken', // Legacy key
      'session_expired_flag'
    ]);
    
    // Also clear the session expired flag using the proper method
    await clearSessionExpiredFlag();
    
    console.log('All auth data cleared');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
}

/**
 * Fix stuck session expired state
 */
export async function fixSessionExpiredFlag() {
  try {
    await clearSessionExpiredFlag();
    console.log('Session expired flag cleared');
    return { success: true };
  } catch (error) {
    console.error('Error clearing session expired flag:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Simulate a login (for testing)
 */
export async function simulateLogin(email = 'test@example.com', role = 'tourist') {
  try {
    const mockUserData = {
      id: 'test-user-123',
      email: email,
      role: role,
      first_name: 'Test',
      last_name: 'User'
    };
    
    const mockToken = 'test-access-token-' + Date.now();
    const mockRefreshToken = 'test-refresh-token-' + Date.now();
    
    await AsyncStorage.setItem('access_token', mockToken);
    await AsyncStorage.setItem('refresh_token', mockRefreshToken);
    await AsyncStorage.setItem('user_data', JSON.stringify(mockUserData));
    
    console.log('Simulated login complete:', mockUserData);
    return { success: true, user: mockUserData };
  } catch (error) {
    console.error('Error simulating login:', error);
    return { success: false, error: error.message };
  }
}

// Export as default for easy debugging
export default {
  debugAuthStatus,
  clearAllAuthData,
  fixSessionExpiredFlag,
  simulateLogin
};
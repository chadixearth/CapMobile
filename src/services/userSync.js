import { apiBaseUrl } from './networkConfig';
import { getAccessToken } from './authService';

const API_BASE_URL = apiBaseUrl();

/**
 * Sync user to Django backend (Supabase-based)
 */
export const syncUserToBackend = async (user) => {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/auth/sync-user/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name || user.email?.split('@')[0] || 'User',
        role: user.role || 'tourist',
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      const errorMsg = result.error || `HTTP ${response.status}`;
      // Handle RLS policy errors specifically
      if (errorMsg.includes('row-level security policy') || errorMsg.includes('42501')) {
        console.log('User sync blocked by RLS policy - this is expected in some configurations');
        return {
          success: false,
          error: 'User sync blocked by database policy',
          rls_error: true
        };
      }
      throw new Error(errorMsg);
    }

    return {
      success: true,
      data: result.data || result,
    };
  } catch (error) {
    const isRLSError = error.message?.includes('row-level security policy') || 
                      error.message?.includes('42501');
    
    if (isRLSError) {
      console.log('User sync blocked by RLS policy');
      return {
        success: false,
        error: 'User sync blocked by database policy',
        rls_error: true
      };
    }
    
    console.log('User sync error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to sync user',
    };
  }
};
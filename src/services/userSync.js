import { supabase } from './supabase';
import { apiBaseUrl } from './networkConfig';

const API_BASE_URL = apiBaseUrl();

/**
 * Sync user from Supabase to Django backend
 */
export const syncUserToBackend = async (user) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/sync-user/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: user.user_metadata?.role || 'tourist',
        phone: user.user_metadata?.phone || null,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      data: result.data || result,
    };
  } catch (error) {
    console.error('Error syncing user to backend:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync user',
    };
  }
};
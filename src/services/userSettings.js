// User Settings API service
// Manages user preferences including anonymous review settings
import { apiBaseUrl } from './networkConfig';
import { getAccessToken } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = 'user_settings';

async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// Default settings
const DEFAULT_SETTINGS = {
  anonymousReviews: false, // Default to not anonymous
  notifications: true,
  locationSharing: true,
};

// Get user settings from local storage
export async function getUserSettings() {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return { success: true, data: { ...DEFAULT_SETTINGS, ...settings } };
    }
    return { success: true, data: DEFAULT_SETTINGS };
  } catch (error) {
    console.error('Error getting user settings:', error);
    return { success: true, data: DEFAULT_SETTINGS };
  }
}

// Save user settings to local storage
export async function saveUserSettings(settings) {
  try {
    const currentSettings = await getUserSettings();
    const updatedSettings = { 
      ...currentSettings.data, 
      ...settings,
      lastUpdated: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
    return { success: true, data: updatedSettings };
  } catch (error) {
    console.error('Error saving user settings:', error);
    return { success: false, error: error.message || 'Failed to save settings' };
  }
}

// Update anonymous review preference
export async function updateAnonymousReviewSetting(isAnonymous) {
  try {
    const result = await saveUserSettings({ anonymousReviews: isAnonymous });
    return result;
  } catch (error) {
    return { success: false, error: error.message || 'Failed to update anonymous setting' };
  }
}

// Get anonymous review preference
export async function getAnonymousReviewSetting() {
  try {
    const settings = await getUserSettings();
    return { 
      success: true, 
      data: { isAnonymous: settings.data.anonymousReviews || false }
    };
  } catch (error) {
    return { success: true, data: { isAnonymous: false } };
  }
}

// Clear all settings (for logout)
export async function clearUserSettings() {
  try {
    await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
    return { success: true };
  } catch (error) {
    console.error('Error clearing user settings:', error);
    return { success: false, error: error.message };
  }
}
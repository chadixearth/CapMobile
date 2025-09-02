// Global fetch interceptor to catch 401/403 and trigger session expiry flow
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalSession } from './authService';
import { emit, EVENTS } from './eventBus';

const FLAG_KEY = 'session_expired_flag';
let installed = false;
let inProgress = false;
let lastTriggerTs = 0;

export function installFetchInterceptor() {
  if (installed || typeof fetch !== 'function') return;
  const originalFetch = fetch;
  installed = true;

  // Wrap fetch
  // eslint-disable-next-line no-global-assign
  fetch = async function(input, init = {}) {
    let response;
    try {
      response = await originalFetch(input, init);
    } catch (err) {
      // Network errors pass through
      throw err;
    }

    try {
      if (response && (response.status === 401 || response.status === 403)) {
        // Only trigger session expiry for auth-related endpoints that actually exist
        const url = typeof input === 'string' ? input : input.url;
        const isAuthEndpoint = url && (
          url.includes('/auth/login') || 
          url.includes('/auth/logout') ||
          url.includes('/auth/register') ||
          // Only trigger for endpoints that have Authorization header (authenticated requests)
          (init && init.headers && init.headers.Authorization)
        );
        
        if (isAuthEndpoint) {
          const now = Date.now();
          if (!inProgress || now - lastTriggerTs > 5000) {
            inProgress = true;
            lastTriggerTs = now;
            console.log('Session expired - clearing auth data for authenticated request:', url);
            try {
              await clearLocalSession();
              await AsyncStorage.setItem(FLAG_KEY, '1');
            } catch {}
            emit(EVENTS.SESSION_EXPIRED, { status: response.status, url });
            // Give UI a moment to react
            setTimeout(() => { inProgress = false; }, 1500);
          }
        } else {
          console.log('401/403 on non-auth endpoint, not triggering session expiry:', url);
        }
      }
    } catch {}

    return response;
  };
}

export async function wasSessionExpiredFlagSet() {
  try {
    const v = await AsyncStorage.getItem(FLAG_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function clearSessionExpiredFlag() {
  try {
    await AsyncStorage.removeItem(FLAG_KEY);
  } catch {}
}

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
        const now = Date.now();
        if (!inProgress || now - lastTriggerTs > 5000) {
          inProgress = true;
          lastTriggerTs = now;
          try {
            await clearLocalSession();
            await AsyncStorage.setItem(FLAG_KEY, '1');
          } catch {}
          emit(EVENTS.SESSION_EXPIRED, { status: response.status });
          // Give UI a moment to react
          setTimeout(() => { inProgress = false; }, 1500);
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

// Global fetch interceptor to catch 401/403 and trigger session expiry flow
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalSession } from './authService';
import { emit, EVENTS } from './eventBus';

const FLAG_KEY = 'session_expired_flag';
let installed = false;
let inProgress = false;
let lastTriggerTs = 0;

export function installFetchInterceptor() {
  console.log('[FetchInterceptor] Disabled - using UnifiedAuth only');
  // Disabled to use only UnifiedAuth system
}

export async function wasSessionExpiredFlagSet() {
  return false; // Disabled
}

export async function clearSessionExpiredFlag() {
  // Disabled
}

import React, { useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, logoutUser, validateSession, setSessionExpiredCallback } from '../services/authService';
import { supabase } from '../services/supabase';
import AuthApiLoader from '../services/AuthApiLoader';
import ModalManager from '../services/ModalManager';

/**
 * Custom hook for authentication state management
 * Provides centralized auth state, user info, and auth actions
 */
// Global auth state to ensure all components get updates
let globalAuthState = {
  isAuthenticated: false,
  user: null,
  role: null,
  loading: true,
  initialized: false
};

let authListeners = new Set();

const notifyAuthListeners = () => {
  authListeners.forEach(listener => listener(globalAuthState));
};

export const useAuth = () => {
  const [authState, setAuthState] = useState(globalAuthState);
  const [forceUpdate, setForceUpdate] = useState(0);

  React.useEffect(() => {
    const listener = (newState) => {
      setAuthState({...newState});
    };
    authListeners.add(listener);
    return () => authListeners.delete(listener);
  }, []);

  const { isAuthenticated, user, loading, role } = authState;

  const updateGlobalAuthState = (updates) => {
    globalAuthState = { ...globalAuthState, ...updates };
    notifyAuthListeners();
  };

  // Check authentication status
  const checkAuth = useCallback(async (validateWithBackend = false) => {
    try {
      updateGlobalAuthState({ loading: true });
      
      // Always do local check first
      const authStatus = await checkAuthStatus();
      
      if (!authStatus.isLoggedIn || !authStatus.user) {
        updateGlobalAuthState({
          isAuthenticated: false,
          user: null,
          role: null,
          loading: false
        });
        return;
      }
      
      // If local check passes, set the auth state
      updateGlobalAuthState({
        isAuthenticated: true,
        user: authStatus.user,
        role: authStatus.user.role || 'tourist',
        loading: false
      });
      
      // Only validate with backend if explicitly requested AND we have a strong reason
      // Be more conservative about backend validation to prevent false session expiry
      if (validateWithBackend) {
        try {
          console.log('Performing backend session validation...');
          const validationResult = await validateSession();
          if (!validationResult.valid) {
            // Backend validation failed, clear auth state and auto-logout
            console.log('Session expired, auto-logging out');
            await logoutUser();
            updateGlobalAuthState({
              isAuthenticated: false,
              user: null,
              role: null
            });
          } else if (validationResult.user) {
            // Update user data from backend if available
            updateGlobalAuthState({
              user: validationResult.user,
              role: validationResult.user.role || 'tourist'
            });
          }
        } catch (error) {
          console.warn('Backend validation failed, keeping local session:', error);
          // Don't clear local session on backend validation errors
          // This prevents false session expiry on network/endpoint issues
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      updateGlobalAuthState({
        isAuthenticated: false,
        user: null,
        role: null,
        loading: false
      });
    } finally {
      updateGlobalAuthState({ loading: false });
    }
  }, []);

  // Logout function
  const logout = useCallback(async (navigationRef = null) => {
    console.log('[useAuth] Starting logout process');
    
    // Clear state immediately
    updateGlobalAuthState({
      isAuthenticated: false,
      user: null,
      role: null,
      loading: false
    });
    
    // Clear caches
    AuthApiLoader.clearCache();
    
    // Clear authenticated data
    try {
      const AppInitService = (await import('../services/AppInitService')).default;
      AppInitService.clearAuthenticatedData();
    } catch (error) {
      console.warn('[useAuth] Failed to clear authenticated data:', error);
    }
    
    // Force navigation to Welcome
    const navRef = navigationRef || global.navigationRef;
    if (navRef && navRef.isReady()) {
      try {
        console.log('[useAuth] Attempting navigation to Welcome');
        navRef.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
        console.log('[useAuth] Successfully navigated to Welcome screen');
      } catch (error) {
        console.warn('[useAuth] Failed to navigate to Welcome:', error);
      }
    } else {
      console.warn('[useAuth] Navigation ref not available or not ready');
      // Force state update to trigger RootNavigator re-render
      setTimeout(() => {
        console.log('[useAuth] Forcing auth state update after logout');
        updateGlobalAuthState({
          isAuthenticated: false,
          user: null,
          role: null
        });
      }, 50);
    }
    
    // Backend cleanup (non-blocking)
    logoutUser().catch(() => {});
    supabase.auth.signOut().catch(() => {});
    
    console.log('[useAuth] Logout complete');
    return { success: true };
  }, []);

  // Login function (updates local state and loads authenticated APIs)
  const login = useCallback(async (userData) => {
    console.log('[useAuth] Setting authentication state for user:', userData.id);
    
    updateGlobalAuthState({
      user: userData,
      role: userData.role || 'tourist',
      isAuthenticated: true,
      loading: false
    });
    
    // Load authenticated data in background
    try {
      const AppInitService = (await import('../services/AppInitService')).default;
      AppInitService.loadAuthenticatedData(userData.id).catch(error => {
        console.warn('[useAuth] Failed to load authenticated data:', error);
      });
    } catch (error) {
      console.warn('[useAuth] Failed to import AppInitService:', error);
    }
    
    console.log('[useAuth] State updated - authenticated:', true, 'role:', userData.role || 'tourist');
    
    // Force navigation update
    setTimeout(() => {
      console.log('[useAuth] Final auth state:', { isAuthenticated: true, role: userData.role || 'tourist' });
    }, 100);
  }, []);

  // Initialize auth state on hook mount
  useEffect(() => {
    // Only check auth on initial mount, not on every render
    if (!globalAuthState.initialized) {
      globalAuthState.initialized = true;
      checkAuth();
    }
    
    // Set up global session expiry handler
    setSessionExpiredCallback(() => {
      console.log('[useAuth] Session expired, auto-logging out');
      ModalManager.closeAllModals();
      updateGlobalAuthState({
        isAuthenticated: false,
        user: null,
        role: null
      });
    });
  }, []); // Remove checkAuth from dependencies to avoid infinite loop

  return {
    isAuthenticated,
    user,
    role,
    loading,
    checkAuth,
    login,
    logout,
  };
};

/**
 * Hook to require authentication
 * Authentication state is handled by RootNavigator
 */
export const useRequireAuth = (navigation) => {
  const auth = useAuth();
  return auth;
};

/**
 * Hook to require specific role
 * Authentication and role state is handled by RootNavigator
 */
export const useRequireRole = (requiredRoles, navigation) => {
  const auth = useAuth();
  return auth;
};

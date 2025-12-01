import React, { useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, logoutUser, validateSession, setSessionExpiredCallback, setProfileUpdateCallback } from '../services/authService';
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
            // Backend validation failed, clear auth state
            console.log('Session expired, clearing auth state');
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
    
    try {
      // Set loading state during logout
      updateGlobalAuthState({ loading: true });
      
      // Backend cleanup first (with timeout)
      const logoutPromise = Promise.race([
        logoutUser(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 5000))
      ]);
      
      try {
        await logoutPromise;
        console.log('[useAuth] Backend logout successful');
      } catch (error) {
        console.warn('[useAuth] Backend logout failed or timed out:', error.message);
        // Continue with local cleanup even if backend fails
      }
      
      // Clear local state and caches
      AuthApiLoader.clearCache();
      
      // Clear authenticated data
      try {
        const AppInitService = (await import('../services/AppInitService')).default;
        AppInitService.clearAuthenticatedData();
      } catch (error) {
        console.warn('[useAuth] Failed to clear authenticated data:', error);
      }
      
      // Supabase cleanup (non-blocking)
      supabase.auth.signOut().catch(() => {});
      
      // Clear auth state last
      updateGlobalAuthState({
        isAuthenticated: false,
        user: null,
        role: null,
        loading: false
      });
      
      console.log('[useAuth] Auth state cleared, RootNavigator will handle navigation');
      console.log('[useAuth] Logout complete');
      
      return { success: true };
    } catch (error) {
      console.error('[useAuth] Logout error:', error);
      
      // Force clear state even on error
      updateGlobalAuthState({
        isAuthenticated: false,
        user: null,
        role: null,
        loading: false
      });
      
      return { success: true }; // Always return success for logout
    }
  }, []);

  // Login function (updates local state and loads authenticated APIs)
  const login = useCallback(async (userData) => {
    console.log('[useAuth] Setting authentication state for user:', userData.id);
    
    // Set loading to true first to trigger proper navigation reset
    updateGlobalAuthState({ loading: true });
    
    // Small delay to ensure state propagates
    await new Promise(resolve => setTimeout(resolve, 50));
    
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
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!globalAuthState.isAuthenticated || !globalAuthState.user) {
      return;
    }
    
    try {
      const { getCurrentUser, getUserProfile } = await import('../services/authService');
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        const profileResult = await getUserProfile(currentUser.id);
        let userData = currentUser;
        
        if (profileResult.success && profileResult.data) {
          userData = { ...currentUser, ...profileResult.data };
          
          // Update full name if individual name parts exist
          if (profileResult.data.first_name || profileResult.data.middle_name || profileResult.data.last_name) {
            const fullName = [
              profileResult.data.first_name,
              profileResult.data.middle_name,
              profileResult.data.last_name,
            ].filter(Boolean).join(' ');
            userData.name = fullName;
            userData.full_name = fullName;
          }
        }
        
        updateGlobalAuthState({
          user: userData,
          role: userData.role || globalAuthState.role
        });
        
        console.log('[useAuth] User data refreshed successfully');
      }
    } catch (error) {
      console.warn('[useAuth] Failed to refresh user data:', error);
    }
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
    
    // Set up profile update handler
    setProfileUpdateCallback((updatedUser) => {
      console.log('[useAuth] Profile updated, refreshing auth state');
      updateGlobalAuthState({
        user: updatedUser,
        role: updatedUser.role || globalAuthState.role
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
    refreshUser,
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

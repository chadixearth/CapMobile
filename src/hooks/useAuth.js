import { useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, logoutUser, validateSession, setSessionExpiredCallback } from '../services/authService';
import { supabase } from '../services/supabase';
import AuthApiLoader from '../services/AuthApiLoader';
import ModalManager from '../services/ModalManager';

/**
 * Custom hook for authentication state management
 * Provides centralized auth state, user info, and auth actions
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Check authentication status
  const checkAuth = useCallback(async (validateWithBackend = false) => {
    try {
      setLoading(true);
      
      // Always do local check first
      const authStatus = await checkAuthStatus();
      
      if (!authStatus.isLoggedIn || !authStatus.user) {
        setIsAuthenticated(false);
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      // If local check passes, set the auth state
      setIsAuthenticated(true);
      setUser(authStatus.user);
      setRole(authStatus.user.role || 'tourist');
      
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
            setIsAuthenticated(false);
            setUser(null);
            setRole(null);
          } else if (validationResult.user) {
            // Update user data from backend if available
            setUser(validationResult.user);
            setRole(validationResult.user.role || 'tourist');
          }
        } catch (error) {
          console.warn('Backend validation failed, keeping local session:', error);
          // Don't clear local session on backend validation errors
          // This prevents false session expiry on network/endpoint issues
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    console.log('[useAuth] Starting logout process');
    
    // Clear state immediately
    setIsAuthenticated(false);
    setUser(null);
    setRole(null);
    setLoading(false);
    
    // Clear cache
    AuthApiLoader.clearCache();
    
    // Backend cleanup (non-blocking)
    logoutUser().catch(() => {});
    supabase.auth.signOut().catch(() => {});
    
    console.log('[useAuth] Logout complete');
    return { success: true };
  }, []);

  // Login function (updates local state and loads authenticated APIs)
  const login = useCallback((userData) => {
    console.log('[useAuth] Setting authentication state for user:', userData.id);
    
    setUser(userData);
    setRole(userData.role || 'tourist');
    setIsAuthenticated(true);
    setLoading(false);
    
    console.log('[useAuth] State updated - authenticated:', true, 'role:', userData.role || 'tourist');
  }, []);

  // Initialize auth state on hook mount
  useEffect(() => {
    checkAuth();
    
    // Set up global session expiry handler
    setSessionExpiredCallback(() => {
      console.log('[useAuth] Session expired, auto-logging out');
      ModalManager.closeAllModals();
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
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

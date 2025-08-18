import { useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, logoutUser, validateSession } from '../services/authService';
import { supabase } from '../services/supabase';

/**
 * Custom hook for authentication state management
 * Provides centralized auth state, user info, and auth actions
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  // Check authentication status
  const checkAuth = useCallback(async (validateWithBackend = false) => {
    try {
      setLoading(true);
      
      let authResult;
      if (validateWithBackend) {
        // Validate with backend for critical operations
        authResult = await validateSession();
        if (authResult.valid) {
          setIsAuthenticated(true);
          setUser(authResult.user);
          setRole(authResult.user.role || 'tourist');
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setRole(null);
        }
      } else {
        // Quick local check for UI purposes
        const authStatus = await checkAuthStatus();
        if (authStatus.isLoggedIn && authStatus.user) {
          setIsAuthenticated(true);
          setUser(authStatus.user);
          setRole(authStatus.user.role || 'tourist');
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setRole(null);
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
    try {
      await logoutUser();
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if API call fails
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
      return { success: true, error: error.message };
    }
  }, []);

  // Login function (updates local state)
  const login = useCallback((userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    setRole(userData.role || 'tourist');
  }, []);

  // Initialize auth state on hook mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
 * Redirects to login if not authenticated
 */
export const useRequireAuth = (navigation) => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

  return auth;
};

/**
 * Hook to require specific role
 * Redirects if user doesn't have required role
 */
export const useRequireRole = (requiredRoles, navigation) => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading) {
      if (!auth.isAuthenticated) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
      } else if (requiredRoles && !requiredRoles.includes(auth.role)) {
        // User doesn't have required role, redirect to appropriate screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    }
  }, [auth.loading, auth.isAuthenticated, auth.role, requiredRoles, navigation]);

  return auth;
};

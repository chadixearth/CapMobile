import { useState, useEffect, useCallback } from 'react';
import ApiInitService from '../services/ApiInitService';
import { useAuth } from './useAuth';

/**
 * Hook to access cached API data and manage loading states
 */
export const useApiData = () => {
  const { isAuthenticated, user } = useAuth();
  const [publicData, setPublicData] = useState({});
  const [authenticatedData, setAuthenticatedData] = useState({});
  const [loading, setLoading] = useState({
    public: false,
    authenticated: false,
  });
  const [status, setStatus] = useState(ApiInitService.getStatus());

  // Update local state when API data changes
  const updateData = useCallback(() => {
    setPublicData(ApiInitService.getPublicData());
    setAuthenticatedData(ApiInitService.getAuthenticatedData());
    setStatus(ApiInitService.getStatus());
  }, []);

  // Load authenticated data when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.id && !status.authenticatedDataLoaded) {
      setLoading(prev => ({ ...prev, authenticated: true }));
      
      ApiInitService.loadAuthenticatedData(user.id)
        .then(() => {
          updateData();
          console.log('[useApiData] Authenticated data loaded');
        })
        .catch((error) => {
          console.error('[useApiData] Failed to load authenticated data:', error);
        })
        .finally(() => {
          setLoading(prev => ({ ...prev, authenticated: false }));
        });
    }
  }, [isAuthenticated, user?.id, status.authenticatedDataLoaded, updateData]);

  // Clear authenticated data when user logs out
  useEffect(() => {
    if (!isAuthenticated && status.authenticatedDataLoaded) {
      ApiInitService.clearAuthenticatedData();
      updateData();
      console.log('[useApiData] Authenticated data cleared');
    }
  }, [isAuthenticated, status.authenticatedDataLoaded, updateData]);

  // Initialize data on mount
  useEffect(() => {
    updateData();
  }, [updateData]);

  // Refresh specific data
  const refreshData = useCallback(async (dataType) => {
    const userId = user?.id;
    setLoading(prev => ({ 
      ...prev, 
      [dataType.includes('tour') || dataType.includes('carriage') ? 'public' : 'authenticated']: true 
    }));
    
    try {
      await ApiInitService.refreshData(dataType, userId);
      updateData();
      return true;
    } catch (error) {
      console.error(`[useApiData] Failed to refresh ${dataType}:`, error);
      return false;
    } finally {
      setLoading(prev => ({ 
        ...prev, 
        [dataType.includes('tour') || dataType.includes('carriage') ? 'public' : 'authenticated']: false 
      }));
    }
  }, [user?.id, updateData]);

  return {
    // Data
    tourPackages: publicData.tourPackages || [],
    carriages: publicData.carriages || [],
    bookings: authenticatedData.bookings || [],
    userCarriages: authenticatedData.userCarriages || [],
    earnings: authenticatedData.earnings || [],
    
    // Status
    isPublicDataLoaded: status.publicDataLoaded,
    isAuthenticatedDataLoaded: status.authenticatedDataLoaded,
    loading,
    
    // Actions
    refreshData,
    
    // Raw data access
    getPublicData: ApiInitService.getPublicData.bind(ApiInitService),
    getAuthenticatedData: ApiInitService.getAuthenticatedData.bind(ApiInitService),
  };
};

/**
 * Hook for specific data types with loading states
 */
export const useTourPackages = () => {
  const { tourPackages, isPublicDataLoaded, loading, refreshData } = useApiData();
  
  return {
    data: tourPackages,
    loading: loading.public,
    loaded: isPublicDataLoaded,
    refresh: () => refreshData('tourPackages'),
  };
};

export const useCarriages = () => {
  const { carriages, isPublicDataLoaded, loading, refreshData } = useApiData();
  
  return {
    data: carriages,
    loading: loading.public,
    loaded: isPublicDataLoaded,
    refresh: () => refreshData('carriages'),
  };
};

export const useUserBookings = () => {
  const { bookings, isAuthenticatedDataLoaded, loading, refreshData } = useApiData();
  
  return {
    data: bookings,
    loading: loading.authenticated,
    loaded: isAuthenticatedDataLoaded,
    refresh: () => refreshData('bookings'),
  };
};

export const useUserCarriages = () => {
  const { userCarriages, isAuthenticatedDataLoaded, loading, refreshData } = useApiData();
  
  return {
    data: userCarriages,
    loading: loading.authenticated,
    loaded: isAuthenticatedDataLoaded,
    refresh: () => refreshData('userCarriages'),
  };
};

export const useUserEarnings = () => {
  const { earnings, isAuthenticatedDataLoaded, loading, refreshData } = useApiData();
  
  return {
    data: earnings,
    loading: loading.authenticated,
    loaded: isAuthenticatedDataLoaded,
    refresh: () => refreshData('earnings'),
  };
};
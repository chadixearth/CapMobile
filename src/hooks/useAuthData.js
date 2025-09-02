import { useState, useEffect } from 'react';
import AuthApiLoader from '../services/AuthApiLoader';
import { useAuth } from './useAuth';

/**
 * Simple hook to access authenticated user data
 */
export const useAuthData = () => {
  const { isAuthenticated, user } = useAuth();
  const [data, setData] = useState({});

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Get cached data
      const cachedData = AuthApiLoader.getCache();
      setData(cachedData);
    } else {
      setData({});
    }
  }, [isAuthenticated, user?.id]);

  return {
    bookings: data.bookings || [],
    userCarriages: data.userCarriages || [],
    earnings: data.earnings || [],
    hasData: Object.keys(data).length > 0,
  };
};
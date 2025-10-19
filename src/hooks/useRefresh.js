import { useState, useCallback } from 'react';

export const useRefresh = (refreshFunctions = [], options = {}) => {
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    
    try {
      await Promise.all(refreshFunctions.map(fn => fn()));
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFunctions, refreshing]);

  return { refreshing, onRefresh };
};
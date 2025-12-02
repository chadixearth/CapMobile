import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const { user } = useAuth();

  const filterTestNotifications = async (notifications) => {
    // Load persisted read notifications
    let persistedReadIds = [];
    try {
      const stored = await AsyncStorage.getItem(`readNotifications_${user?.id}`);
      persistedReadIds = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.log('[NotificationContext] Error loading persisted read notifications:', error);
    }
    
    return notifications.map(n => {
      // Mark as read if it was previously marked as read and persisted
      const wasMarkedRead = persistedReadIds.includes(n.id);
      if (wasMarkedRead && !n.read) {
        console.log(`[NotificationContext] Restoring read state for notification ${n.id}`);
        return { ...n, read: true };
      }
      
      console.log('[NotificationContext] Processing notification:', { id: n.id, title: n.title, read: n.read });
      return n;
    });
  };

  const loadNotifications = async () => {
    if (!user?.id) {
      console.log('[NotificationContext] No user ID, skipping notification load');
      return;
    }
    
    // Debounce to prevent excessive loading (minimum 2 seconds between loads)
    const now = Date.now();
    if (now - lastLoadTime < 2000) {
      console.log('[NotificationContext] Debouncing notification load');
      return;
    }
    setLastLoadTime(now);
    
    try {
      console.log(`[NotificationContext] Loading notifications for user: ${user.id}`);
      const result = await NotificationService.getNotifications(user.id);
      console.log(`[NotificationContext] Service result:`, result);
      
      if (result.success) {
        const filtered = await filterTestNotifications(result.data || []);
        const newUnreadCount = filtered.filter(n => !n.read).length;
        
        console.log(`[NotificationContext] Filtered notifications: ${filtered.length}, unread: ${newUnreadCount}`);
        
        setNotifications(filtered);
        setUnreadCount(newUnreadCount);
      } else {
        console.log(`[NotificationContext] Service failed:`, result.error);
      }
    } catch (error) {
      console.error('[NotificationContext] Error loading notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification?.read) return;
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      const stored = await AsyncStorage.getItem(`readNotifications_${user?.id}`);
      const readIds = stored ? JSON.parse(stored) : [];
      if (!readIds.includes(notificationId)) {
        await AsyncStorage.setItem(`readNotifications_${user?.id}`, JSON.stringify([...readIds, notificationId]));
      }
      
      await NotificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('[NotificationContext] Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      console.log('[NotificationContext] Marking all notifications as read');
      
      // Get current unread notifications
      const unreadNotifications = notifications.filter(n => !n.read);
      console.log(`[NotificationContext] Found ${unreadNotifications.length} unread notifications`);
      
      if (unreadNotifications.length === 0) {
        console.log('[NotificationContext] No unread notifications to mark');
        return;
      }
      
      // Mark all notifications as read locally first for immediate UI update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      // Store read notifications in AsyncStorage to persist across app restarts
      try {
        const readNotificationIds = unreadNotifications.map(n => n.id);
        const existingReadIds = await AsyncStorage.getItem(`readNotifications_${user?.id}`) || '[]';
        const allReadIds = [...JSON.parse(existingReadIds), ...readNotificationIds];
        await AsyncStorage.setItem(`readNotifications_${user?.id}`, JSON.stringify(allReadIds));
        console.log('[NotificationContext] Persisted read notifications to storage');
      } catch (storageError) {
        console.error('[NotificationContext] Failed to persist read notifications:', storageError);
      }
      
      // Then sync with backend
      const result = await NotificationService.markAllAsRead(user?.id, unreadNotifications);
      console.log('[NotificationContext] Backend sync result:', result);
      
      if (!result.success) {
        console.error('[NotificationContext] Failed to sync mark all as read with backend:', result.error);
      } else {
        console.log('[NotificationContext] All notifications marked as read successfully');
      }
      
    } catch (error) {
      console.error('[NotificationContext] Error marking all as read:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    loadNotifications();

    // Skip subscription since network is failing
    console.log(`[NotificationContext] Skipping subscription due to network issues`);
    const subscription = { unsubscribe: () => {} };

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [user?.id]);

  const value = {
    unreadCount,
    notifications,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const { user } = useAuth();

  const filterTestNotifications = (notifications) => {
    return notifications.filter(n => {
      // Safely check if title and message exist before calling includes
      const title = n.title || '';
      const message = n.message || '';
      
      // Don't filter out any notifications for now to debug
      console.log('[NotificationContext] Processing notification:', { id: n.id, title, message, read: n.read });
      
      return true; // Show all notifications for debugging
    });
  };

  const loadNotifications = async () => {
    if (!user?.id) {
      console.log('[NotificationContext] No user ID, skipping notification load');
      return;
    }
    
    try {
      console.log(`[NotificationContext] Loading notifications for user: ${user.id}`);
      const result = await NotificationService.getNotifications(user.id);
      console.log(`[NotificationContext] Service result:`, result);
      
      if (result.success) {
        const filtered = filterTestNotifications(result.data || []);
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
      await NotificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
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
      
      // Then sync with backend
      const result = await NotificationService.markAllAsRead(user?.id, notifications);
      console.log('[NotificationContext] Backend sync result:', result);
      
      if (!result.success) {
        console.error('[NotificationContext] Failed to sync mark all as read with backend:', result.error);
        // Reload notifications to get correct state
        await loadNotifications();
      } else {
        console.log('[NotificationContext] All notifications marked as read successfully');
      }
    } catch (error) {
      console.error('[NotificationContext] Error marking all as read:', error);
      // Reload notifications to get correct state
      await loadNotifications();
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
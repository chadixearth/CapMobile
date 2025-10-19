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
      
      return (
        !title.includes('Test Notification') && 
        !message.includes('test notification to verify') &&
        !title.includes('Test Booking Request') &&
        !message.includes('Test Tourist') &&
        !message.includes('Test Driver')
      );
    });
  };

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    try {
      const result = await NotificationService.getNotifications(user.id);
      if (result.success) {
        const filtered = filterTestNotifications(result.data || []);
        const newUnreadCount = filtered.filter(n => !n.read).length;
        
        // Check if there are new notifications
        const currentIds = notifications.map(n => n.id);
        const newNotifications = filtered.filter(n => !currentIds.includes(n.id));
        
        if (newNotifications.length > 0) {
          console.log(`[NotificationContext] Found ${newNotifications.length} new notifications`);
        }
        
        setNotifications(filtered);
        setUnreadCount(newUnreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
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
      const result = await NotificationService.markAllAsRead();
      if (result.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    loadNotifications();

    // Subscribe to new notifications
    const subscription = NotificationService.subscribeToNotifications(
      user.id,
      (newNotifications) => {
        if (Array.isArray(newNotifications)) {
          const filtered = filterTestNotifications(newNotifications);
          setNotifications(filtered);
          setUnreadCount(filtered.filter(n => !n.read).length);
        } else if (newNotifications) {
          const filtered = filterTestNotifications([newNotifications]);
          if (filtered.length > 0) {
            setNotifications(prev => {
              const exists = prev.some(n => n.id === filtered[0].id);
              if (exists) {
                return prev.map(n => n.id === filtered[0].id ? filtered[0] : n);
              }
              return [filtered[0], ...prev];
            });
            setUnreadCount(prev => prev + (filtered[0].read ? 0 : 1));
          }
        }
      }
    );

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
      NotificationService.stopPolling();
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
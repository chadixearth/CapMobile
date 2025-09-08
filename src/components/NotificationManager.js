import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import NotificationService from '../services/notificationService';
import { getCurrentUser } from '../services/authService';

/**
 * Global notification manager component
 * Handles real-time notifications across the entire app
 */
const NotificationManager = ({ navigation }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    initializeNotifications();
    
    return () => {
      NotificationService.stopPolling();
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return;
      }
      
      setUser(currentUser);
      console.log(`[NotificationManager] Starting notifications for: ${currentUser.email} (${currentUser.role})`);
      
      // Register for push notifications
      try {
        await NotificationService.registerForPushNotifications();
      } catch (error) {
        console.log('[NotificationManager] Push notifications not available');
      }
      
      // Start polling for notifications
      NotificationService.startPolling(currentUser.id, handleNewNotifications);
      
    } catch (error) {
      console.error('[NotificationManager] Error:', error);
    }
  };

  const handleNewNotifications = (notifications) => {
    if (!notifications || notifications.length === 0) return;
    
    notifications.forEach(notification => {
      handleNotificationByType(notification);
    });
  };

  const handleNotificationByType = (notification) => {
    const { type, title, message } = notification;
    
    if (type === 'booking') {
      if (user?.role === 'driver' || user?.role === 'driver-owner') {
        Alert.alert(
          '🚗 New Booking Available!',
          message,
          [
            { text: 'View Bookings', onPress: () => navigation?.navigate('DriverBook') },
            { text: 'OK' }
          ]
        );
      } else if (user?.role === 'tourist') {
        Alert.alert(
          '✅ Booking Update!',
          message,
          [
            { text: 'View Bookings', onPress: () => navigation?.navigate('BookingHistory') },
            { text: 'OK' }
          ]
        );
      }
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  };

  // This component doesn't render anything
  return null;
};

export default NotificationManager;
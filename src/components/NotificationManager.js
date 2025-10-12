import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../services/notificationService';
import { getCurrentUser } from '../services/authService';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Global notification manager component
 * Handles real-time notifications across the entire app
 */
const NotificationManager = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [shownNotifications, setShownNotifications] = useState(new Set());
  const { loadNotifications, notifications: contextNotifications } = useNotifications();

  useEffect(() => {
    initializeNotifications();
    loadDismissedNotifications();
    
    return () => {
      NotificationService.stopPolling();
    };
  }, []);
  
  // Update dismissed notifications when context notifications change (e.g., marked as read)
  useEffect(() => {
    if (contextNotifications && contextNotifications.length > 0) {
      const readNotifications = contextNotifications
        .filter(n => n.read)
        .map(n => `${n.id}_${n.created_at}`);
      
      if (readNotifications.length > 0) {
        setShownNotifications(prev => new Set([...prev, ...readNotifications]));
        AsyncStorage.setItem('dismissedNotifications', JSON.stringify([...shownNotifications, ...readNotifications]));
      }
    }
  }, [contextNotifications]);

  const loadDismissedNotifications = async () => {
    try {
      const dismissed = await AsyncStorage.getItem('dismissedNotifications');
      if (dismissed) {
        setShownNotifications(new Set(JSON.parse(dismissed)));
      }
    } catch (error) {
      console.log('Error loading dismissed notifications:', error);
    }
  };

  const saveDismissedNotification = async (notificationKey) => {
    try {
      const newSet = new Set([...shownNotifications, notificationKey]);
      setShownNotifications(newSet);
      await AsyncStorage.setItem('dismissedNotifications', JSON.stringify([...newSet]));
    } catch (error) {
      console.log('Error saving dismissed notification:', error);
    }
  };

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
        // Silently handle push notification errors
      }
      
      // Start polling for notifications
      NotificationService.startPolling(currentUser.id, handleNewNotifications);
      
    } catch (error) {
      console.error('[NotificationManager] Error:', error);
    }
  };

  const handleNewNotifications = (notifications) => {
    if (!notifications || notifications.length === 0) return;
    
    // Reload notifications in context to update badge count
    loadNotifications();
    
    // Only show one notification at a time to prevent modal spam
    const unshownNotifications = notifications.filter(notification => {
      const notificationKey = `${notification.id}_${notification.created_at}`;
      return !shownNotifications.has(notificationKey) && !notification.read && !notification.tapped;
    });
    
    if (unshownNotifications.length > 0) {
      // Show only the most recent notification
      handleNotificationByType(unshownNotifications[0]);
    }
  };

  const handleNotificationByType = (notification) => {
    // Only show alerts for new notifications (not already read)
    if (notification.read || notification.tapped) {
      return;
    }
    
    const { type, title, message } = notification;
    
    // Prevent duplicate alerts by tracking shown notifications
    const notificationKey = `${notification.id}_${notification.created_at}`;
    if (shownNotifications.has(notificationKey)) {
      return;
    }
    
    // Mark as shown immediately to prevent duplicate alerts
    saveDismissedNotification(notificationKey);
    
    // Mark notification as read when modal is shown
    const markAsReadAndNavigate = async (screenName) => {
      try {
        await NotificationService.markAsRead(notification.id);
        loadNotifications(); // Refresh context
        if (screenName && navigation) {
          navigation.navigate(screenName);
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    };
    
    // Handle different notification types with specific navigation
    switch (type) {
      case 'booking':
        if (user?.role === 'driver' || user?.role === 'driver-owner') {
          Alert.alert(
            '🚗 New Booking Available!',
            message,
            [
              { 
                text: 'View Bookings', 
                onPress: () => {
                  markAsReadAndNavigate();
                  // Navigate to Main tabs then to Bookings tab
                  navigation?.navigate('Main', { screen: 'Bookings' });
                }
              },
              { 
                text: 'OK',
                onPress: () => markAsReadAndNavigate()
              }
            ]
          );
        } else if (user?.role === 'tourist') {
          Alert.alert(
            '✅ Booking Update!',
            message,
            [
              { 
                text: 'View Bookings', 
                onPress: () => markAsReadAndNavigate('BookingHistory')
              },
              { 
                text: 'OK',
                onPress: () => markAsReadAndNavigate()
              }
            ]
          );
        }
        break;
        
      case 'payment':
      case 'pay_receive':
        Alert.alert(
          '💰 Payment Update',
          message,
          [
            { 
              text: 'View Earnings', 
              onPress: () => {
                markAsReadAndNavigate();
                if (user?.role === 'driver') {
                  navigation?.navigate('Main', { screen: 'Earnings' });
                } else {
                  navigation?.navigate('DriverEarnings');
                }
              }
            },
            { 
              text: 'OK',
              onPress: () => markAsReadAndNavigate()
            }
          ]
        );
        break;
        
      case 'driver_earnings':
      case 'earnings':
        Alert.alert(
          '📊 Earnings Update',
          message,
          [
            { 
              text: 'View Earnings', 
              onPress: () => {
                markAsReadAndNavigate();
                if (user?.role === 'driver') {
                  navigation?.navigate('Main', { screen: 'Earnings' });
                } else {
                  navigation?.navigate('DriverEarnings');
                }
              }
            },
            { 
              text: 'OK',
              onPress: () => markAsReadAndNavigate()
            }
          ]
        );
        break;
        
      case 'profile':
      case 'account':
        Alert.alert(
          '👤 Profile Update',
          message,
          [
            { 
              text: 'View Profile', 
              onPress: () => {
                markAsReadAndNavigate();
                navigation?.navigate('Main', { screen: 'Menu' });
              }
            },
            { 
              text: 'OK',
              onPress: () => markAsReadAndNavigate()
            }
          ]
        );
        break;
        
      case 'review':
      case 'rating':
        Alert.alert(
          '⭐ Review Update',
          message,
          [
            { 
              text: 'View Reviews', 
              onPress: () => markAsReadAndNavigate('Reviews')
            },
            { 
              text: 'OK',
              onPress: () => markAsReadAndNavigate()
            }
          ]
        );
        break;
        
      default:
        Alert.alert(
          title,
          message,
          [
            { 
              text: 'OK',
              onPress: () => markAsReadAndNavigate()
            }
          ]
        );
        break;
    }
  };

  // This component doesn't render anything
  return null;
};

export default NotificationManager;
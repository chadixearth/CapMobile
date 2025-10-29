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
      // Clear corrupted notification cache
      try {
        await AsyncStorage.removeItem('dismissedNotifications');
      } catch (clearError) {
        console.log('Error clearing notification cache:', clearError);
      }
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
      
      // Start polling for notifications with reduced frequency
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
      return !shownNotifications.has(notificationKey) && !notification.read;
    });
    
    if (unshownNotifications.length > 0) {
      // Show only the most recent notification
      handleNotificationByType(unshownNotifications[0]);
    }
  };

  const handleNotificationByType = (notification) => {
    // Only show alerts for new notifications (not already read)
    if (notification.read) {
      return;
    }
    
    const { type, title, message } = notification;
    
    // Prevent duplicate alerts by tracking shown notifications
    const notificationKey = `${notification.id}_${notification.created_at}`;
    if (shownNotifications.has(notificationKey)) {
      return;
    }
    
    // Mark notification as read when modal is shown
    const markAsReadAndNavigate = async (screenName) => {
      try {
        // Mark as shown to prevent duplicate alerts
        saveDismissedNotification(notificationKey);
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
      case 'booking_request':
      case 'booking_update':
        if (user?.role === 'driver' || user?.role === 'driver-owner') {
          Alert.alert(
            '🚗 New Booking Available!',
            message,
            [
              { 
                text: 'View Bookings', 
                onPress: () => {
                  markAsReadAndNavigate();
                  try {
                    if (navigation && navigation.navigate) {
                      navigation.navigate('Main', { screen: 'Bookings' });
                    }
                  } catch (navError) {
                    console.error('Navigation error to Bookings:', navError);
                    // Fallback: try direct navigation to Bookings
                    try {
                      navigation.navigate('Bookings');
                    } catch (fallbackError) {
                      console.error('Fallback navigation failed:', fallbackError);
                    }
                  }
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
      case 'breakeven':
      case 'profit_milestone':
        Alert.alert(
          type === 'breakeven' ? '🎯 Breakeven Update' : '📊 Earnings Update',
          message,
          [
            { 
              text: type === 'breakeven' ? 'View Breakeven' : 'View Earnings', 
              onPress: () => {
                markAsReadAndNavigate();
                try {
                  if (navigation && navigation.navigate) {
                    if (user?.role === 'driver' || user?.role === 'driver-owner') {
                      if (type === 'breakeven') {
                        navigation.navigate('Main', { screen: 'Breakeven' });
                      } else {
                        navigation.navigate('Main', { screen: 'Earnings' });
                      }
                    } else {
                      navigation.navigate('DriverEarnings');
                    }
                  }
                } catch (navError) {
                  console.error('Navigation error to earnings/breakeven:', navError);
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
        
      case 'schedule':
      case 'availability':
        if (user?.role === 'driver' || user?.role === 'driver-owner') {
          Alert.alert(
            '📅 Schedule Update',
            message,
            [
              { 
                text: 'View Schedule', 
                onPress: () => {
                  markAsReadAndNavigate();
                  try {
                    if (navigation && navigation.navigate) {
                      navigation.navigate('Main', { screen: 'Schedule' });
                    }
                  } catch (navError) {
                    console.error('Navigation error to Schedule:', navError);
                  }
                }
              },
              { 
                text: 'OK',
                onPress: () => markAsReadAndNavigate()
              }
            ]
          );
        }
        break;
        
      case 'carriage':
      case 'assignment':
        Alert.alert(
          '🚗 Carriage Update',
          message,
          [
            { 
              text: 'View Carriages', 
              onPress: () => markAsReadAndNavigate('MyCarriages')
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
          title || '📢 Notification',
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
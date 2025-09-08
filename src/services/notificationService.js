import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  static pollingInterval = null;
  static lastNotificationCheck = null;
  static callbacks = new Set();
  static locationWatcher = null;
  static pushToken = null;

  // Send notification to backend
  static async sendNotification(userIds, title, message, type = 'info', role = 'tourist') {
    try {
      const { apiBaseUrl } = await import('./networkConfig');
      const response = await fetch(`${apiBaseUrl()}/notifications/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ids: Array.isArray(userIds) ? userIds : [userIds],
          title,
          message,
          type,
          role
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user notifications
  static async getNotifications(userId) {
    try {
      const { apiBaseUrl } = await import('./networkConfig');
      const response = await fetch(`${apiBaseUrl()}/notifications/?user_id=${userId}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      const { apiBaseUrl } = await import('./networkConfig');
      const response = await fetch(`${apiBaseUrl()}/notifications/mark-read/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notification_id: notificationId })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Start real-time polling for notifications
  static startPolling(userId, callback) {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.callbacks.add(callback);
    
    // Register for push notifications (skip in Expo Go)
    try {
      this.registerForPushNotifications();
    } catch (error) {
      console.log('[NotificationService] Push notifications not available');
    }
    
    // Listen for notification responses
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.type === 'booking') {
        callback([{ ...data, tapped: true }]);
      }
    });
    
    // Poll every 5 seconds for new notifications (faster for real-time feel)
    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.getNotifications(userId);
        if (result.success && result.data) {
          // Filter out test notifications
          const filteredData = result.data.filter(n => 
            !n.title.includes('Test Notification') && 
            !n.message.includes('test notification to verify') &&
            !n.title.includes('Test Booking Request') &&
            !n.message.includes('Test Tourist') &&
            !n.message.includes('Test Driver')
          );
          
          const newNotifications = this.lastNotificationCheck 
            ? filteredData.filter(n => new Date(n.created_at) > this.lastNotificationCheck)
            : filteredData.filter(n => !n.read).slice(0, 1);
          
          if (newNotifications.length > 0) {
            const latestNotif = newNotifications[0];
            
            // Send local push notification
            await this.sendLocalNotification(
              latestNotif.title,
              latestNotif.message,
              { type: latestNotif.type, id: latestNotif.id }
            );
            
            // Note: Alert removed to prevent automatic test notifications
            
            this.callbacks.forEach(cb => {
              try {
                cb(newNotifications);
              } catch (error) {
                console.error('Callback error:', error);
              }
            });
          }
          
          this.lastNotificationCheck = new Date();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Initial load
    this.getNotifications(userId).then(result => {
      if (result.success && callback) {
        // Filter out test notifications on initial load too
        const filteredData = (result.data || []).filter(n => 
          !n.title.includes('Test Notification') && 
          !n.message.includes('test notification to verify') &&
          !n.title.includes('Test Booking Request') &&
          !n.message.includes('Test Tourist') &&
          !n.message.includes('Test Driver')
        );
        callback(filteredData);
      }
    });
  }

  // Stop polling
  static stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.callbacks.clear();
  }

  // Subscribe to real-time notifications (fallback to Supabase realtime)
  static subscribeToNotifications(userId, callback) {
    // Start polling as primary method
    this.startPolling(userId, callback);
    
    // Also try Supabase realtime as backup
    try {
      return supabase
        .channel('notification_recipients')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_recipients',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          console.log('Supabase realtime notification:', payload);
          callback([payload.new]);
        })
        .subscribe();
    } catch (error) {
      console.warn('Supabase realtime failed, using polling only:', error);
      return { unsubscribe: () => this.stopPolling() };
    }
  }

  // Notify all drivers when tourist books
  static async notifyDriversOfNewBooking(bookingData) {
    try {
      console.log('[NotificationService] Notifying drivers of new booking:', bookingData.id || 'new booking');
      
      // Get all active drivers from backend API instead of direct Supabase
      const { apiBaseUrl } = await import('./networkConfig');
      const response = await fetch(`${apiBaseUrl()}/auth/users/?role=driver&status=active`);
      
      if (!response.ok) {
        console.warn('Failed to fetch drivers, using fallback method');
        // Fallback to Supabase if API fails
        const { data: drivers } = await supabase
          .from('users')
          .select('id')
          .in('role', ['driver', 'driver-owner'])
          .eq('status', 'active');
        
        if (!drivers || drivers.length === 0) {
          console.log('[NotificationService] No active drivers to notify');
          return { success: true, message: 'No active drivers to notify' };
        }
        
        const driverIds = drivers.map(d => d.id).filter(id => {
          try {
            // Validate UUID format
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          } catch {
            return false;
          }
        });
        
        if (driverIds.length === 0) {
          console.log('[NotificationService] No valid driver UUIDs found');
          return { success: true, message: 'No valid drivers to notify' };
        }
        
        const touristName = bookingData.tourist_name || bookingData.customer_name || 'A tourist';
        const result = await this.sendNotification(
          driverIds,
          'New Booking Request! 🚗',
          `${touristName} needs a driver for ${bookingData.package_name || 'a tour'} (${bookingData.number_of_pax || 1} pax). Tap to accept.`,
          'booking',
          'driver'
        );
        
        console.log('[NotificationService] Driver notification result:', result);
        return result;
      }
      
      const apiResult = await response.json();
      const drivers = apiResult.data || apiResult.users || [];
      
      if (drivers.length === 0) {
        console.log('[NotificationService] No active drivers found via API');
        return { success: true, message: 'No active drivers to notify' };
      }

      // Send notification to all drivers
      const driverIds = drivers.map(d => d.id).filter(id => {
        try {
          // Validate UUID format
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        } catch {
          return false;
        }
      });
      
      if (driverIds.length === 0) {
        console.log('[NotificationService] No valid driver UUIDs found');
        return { success: true, message: 'No valid drivers to notify' };
      }
      
      const touristName = bookingData.tourist_name || bookingData.customer_name || 'A tourist';
      const result = await this.sendNotification(
        driverIds,
        'New Booking Request! 🚗',
        `${touristName} needs a driver for ${bookingData.package_name || 'a tour'} (${bookingData.number_of_pax || 1} pax). Tap to accept.`,
        'booking',
        'driver'
      );
      
      console.log('[NotificationService] Driver notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify drivers:', error);
      // Don't throw error - make it non-blocking
      return { success: false, error: error.message };
    }
  }

  // Notify tourist when driver accepts booking
  static async notifyTouristOfAcceptedBooking(touristId, driverName, bookingData) {
    try {
      console.log('[NotificationService] Notifying tourist of accepted booking:', bookingData.id || 'booking');
      
      // Validate tourist ID format
      if (!touristId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(touristId)) {
        console.warn('[NotificationService] Invalid tourist ID format:', touristId);
        return { success: false, error: 'Invalid tourist ID format' };
      }
      
      const result = await this.sendNotification(
        [touristId],
        'Booking Accepted! ✅',
        `Great news! ${driverName || 'A driver'} has accepted your booking. Get ready for your tour!`,
        'booking',
        'tourist'
      );
      
      console.log('[NotificationService] Tourist notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify tourist:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify tourist when booking is cancelled
  static async notifyTouristOfCancelledBooking(touristId, reason, bookingData) {
    try {
      console.log('[NotificationService] Notifying tourist of cancelled booking:', bookingData.id || 'booking');
      
      // Validate tourist ID format
      if (!touristId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(touristId)) {
        console.warn('[NotificationService] Invalid tourist ID format:', touristId);
        return { success: false, error: 'Invalid tourist ID format' };
      }
      
      const result = await this.sendNotification(
        [touristId],
        'Booking Cancelled ❌',
        `Your booking has been cancelled. ${reason || 'Please contact support for more details.'}`,
        'booking',
        'tourist'
      );
      
      console.log('[NotificationService] Tourist cancellation notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify tourist of cancellation:', error);
      return { success: false, error: error.message };
    }
  }
  // Show immediate notification alert
  static showNotificationAlert(title, message, onPress = null) {
    Alert.alert(
      title,
      message,
      [
        { text: 'OK', onPress: onPress || (() => {}) }
      ]
    );
  }

  // Register for push notifications
  static async registerForPushNotifications() {
    // Skip push notifications in Expo Go completely
    console.log('Push notifications disabled in Expo Go');
    return null;
  }

  // Send local notification
  static async sendLocalNotification(title, message, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
  }

  // Start location tracking for drivers
  static async startLocationTracking(userId, onLocationUpdate) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location access is needed for real-time tracking.');
        return false;
      }

      // Start watching location
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          
          // Update location in database
          try {
            await supabase
              .from('driver_locations')
              .upsert({
                user_id: userId,
                latitude,
                longitude,
                updated_at: new Date().toISOString(),
              });
            
            if (onLocationUpdate) {
              onLocationUpdate({ latitude, longitude });
            }
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  // Stop location tracking
  static stopLocationTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
  }

  // Get driver's current location
  static async getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }


}

export default NotificationService;
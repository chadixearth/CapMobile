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
    
    // Poll every 10 seconds for new notifications
    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.getNotifications(userId);
        if (result.success && result.data) {
          // Check for new notifications since last check
          const newNotifications = this.lastNotificationCheck 
            ? result.data.filter(n => new Date(n.created_at) > this.lastNotificationCheck)
            : result.data.filter(n => !n.read).slice(0, 1); // Only show 1 unread on first load
          
          if (newNotifications.length > 0) {
            // Show alert for new notifications
            const latestNotif = newNotifications[0];
            Alert.alert(
              latestNotif.title,
              latestNotif.message,
              [{ text: 'OK', onPress: () => this.markAsRead(latestNotif.id) }]
            );
            
            // Notify all callbacks
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
    }, 10000); // Poll every 10 seconds

    // Initial load
    this.getNotifications(userId).then(result => {
      if (result.success && callback) {
        callback(result.data || []);
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
      console.log('[NotificationService] Notifying drivers of new booking:', bookingData.id);
      
      // Get all active drivers
      const { data: drivers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['driver', 'driver-owner'])
        .eq('status', 'active');

      if (!drivers || drivers.length === 0) {
        console.log('[NotificationService] No active drivers to notify');
        return { success: true, message: 'No active drivers to notify' };
      }

      // Send notification to all drivers
      const driverIds = drivers.map(d => d.id);
      const touristName = bookingData.tourist_name || bookingData.customer_name || 'A tourist';
      const result = await this.sendNotification(
        driverIds,
        'New Booking Request! 🚗',
        `${touristName} needs a driver for ${bookingData.package_name} (${bookingData.number_of_pax} pax). Tap to accept.`,
        'booking',
        'driver'
      );
      
      console.log('[NotificationService] Driver notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify drivers:', error);
      throw error; // Re-throw to see the error in booking creation
    }
  }

  // Notify tourist when driver accepts booking
  static async notifyTouristOfAcceptedBooking(touristId, driverName, bookingData) {
    console.log('[NotificationService] Notifying tourist of accepted booking:', bookingData.id);
    
    const result = await this.sendNotification(
      [touristId],
      'Booking Accepted! ✅',
      `Great news! ${driverName} has accepted your booking. Get ready for your tour!`,
      'booking_accepted',
      'tourist'
    );
    
    console.log('[NotificationService] Tourist notification result:', result);
    return result;
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
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Push notifications are needed to receive booking updates.');
        return null;
      }
      
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.pushToken = token;
      
      // Store token for this user
      await AsyncStorage.setItem('pushToken', token);
      
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
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

  // Enhanced polling with push notifications
  static startPolling(userId, callback) {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.callbacks.add(callback);
    
    // Register for push notifications
    this.registerForPushNotifications();
    
    // Listen for notification responses
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.type === 'booking') {
        // Handle booking notification tap
        callback([{ ...data, tapped: true }]);
      }
    });
    
    // Poll every 10 seconds for new notifications
    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.getNotifications(userId);
        if (result.success && result.data) {
          const newNotifications = this.lastNotificationCheck 
            ? result.data.filter(n => new Date(n.created_at) > this.lastNotificationCheck)
            : result.data.filter(n => !n.read).slice(0, 1);
          
          if (newNotifications.length > 0) {
            const latestNotif = newNotifications[0];
            
            // Send local push notification
            await this.sendLocalNotification(
              latestNotif.title,
              latestNotif.message,
              { type: latestNotif.type, id: latestNotif.id }
            );
            
            // Also show alert if app is active
            Alert.alert(
              latestNotif.title,
              latestNotif.message,
              [{ text: 'OK', onPress: () => this.markAsRead(latestNotif.id) }]
            );
            
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
    }, 10000);

    // Initial load
    this.getNotifications(userId).then(result => {
      if (result.success && callback) {
        callback(result.data || []);
      }
    });
  }

  // Test notification system
  static async testNotification(userId) {
    return this.sendNotification(
      [userId],
      'Test Notification 🔔',
      'This is a test notification to verify the system is working.',
      'test',
      'tourist'
    );
  }

  // Remove push notification registration (not needed for polling system)
  static async registerForPushNotifications() {
    // Skip push notifications - using polling system instead
    return { success: true, method: 'polling' };
  }
}

export default NotificationService;
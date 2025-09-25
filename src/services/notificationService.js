import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateData } from './dataInvalidationService';
import networkClient from './networkClient';
import ResponseHandler from './responseHandler';

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
      const result = await networkClient.post('/notifications/', {
        user_ids: Array.isArray(userIds) ? userIds : [userIds],
        title,
        message,
        type,
        role
      });
      
      return result.data;
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user notifications
  static async getNotifications(userId) {
    try {
      if (!userId) {
        console.warn('[NotificationService] No user ID provided');
        return ResponseHandler.createSafeResponse([]);
      }
      
      console.log(`[NotificationService] Fetching notifications for user: ${userId}`);
      
      // Use shorter timeout for notifications to prevent blocking
      const result = await networkClient.get(`/notifications/?user_id=${userId}`, {
        timeout: 8000, // Reduced from 15s to 8s
        retries: 2     // Reduced from 3 to 2 retries
      });
      
      // Ensure result has proper structure
      if (!result || !result.data) {
        return ResponseHandler.createSafeResponse([]);
      }
      
      const notifications = result.data?.data || result.data || [];
      console.log(`[NotificationService] Received ${notifications.length} notifications for user ${userId}`);
      
      return ResponseHandler.createSafeResponse(notifications);
    } catch (error) {
      // Don't log timeout errors as errors - they're expected sometimes
      if (error.message && error.message.includes('timeout')) {
        console.log('[NotificationService] Request timeout - returning cached data');
      } else {
        console.error('[NotificationService] Error fetching notifications:', error);
      }
      return ResponseHandler.handleError(error, []);
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      const result = await networkClient.put('/notifications/mark-read/', {
        notification_id: notificationId
      });
      return result.data;
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
    
    // Register for push notifications
    try {
      this.registerForPushNotifications();
    } catch (error) {
      // Ignore push notification errors
    }
    
    // Listen for notification responses
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.type === 'booking') {
        callback([{ ...data, tapped: true }]);
      }
    });
    
    // Poll every 45 seconds for new notifications (increased to reduce server load)
    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.getNotifications(userId);
        if (result.success && result.data) {
          // Only get truly new notifications (not just unread ones)
          const newNotifications = this.lastNotificationCheck 
            ? result.data.filter(n => {
                const notifTime = new Date(n.created_at);
                return notifTime > this.lastNotificationCheck && !n.read;
              })
            : result.data.filter(n => !n.read).slice(0, 3); // Limit initial load to 3 most recent
          
          if (newNotifications.length > 0) {
            // Only send local notifications for truly new ones
            for (const notif of newNotifications) {
              if (this.lastNotificationCheck && new Date(notif.created_at) > this.lastNotificationCheck) {
                await this.sendLocalNotification(
                  notif.title,
                  notif.message,
                  { type: notif.type, id: notif.id }
                );
              }
            }
            
            // Emit data change events based on notification types
            newNotifications.forEach(notif => {
              const title = notif.title?.toLowerCase() || '';
              const message = notif.message?.toLowerCase() || '';
              const type = notif.type?.toLowerCase() || '';
              
              if (type === 'booking' || title.includes('booking') || title.includes('payment')) {
                invalidateData.bookings();
              }
              if (type === 'ride' || title.includes('ride')) {
                invalidateData.rides();
              }
              if (title.includes('earning') || title.includes('payment received')) {
                invalidateData.earnings();
              }
              if (type === 'custom' || title.includes('custom') || title.includes('special')) {
                invalidateData.customRequests();
              }
              if (type === 'profile' || title.includes('profile') || title.includes('account')) {
                invalidateData.profile();
              }
              if (type === 'review' || title.includes('review') || title.includes('rating')) {
                invalidateData.reviews();
              }
              if (type === 'schedule' || title.includes('schedule') || title.includes('availability')) {
                invalidateData.schedule();
              }
              if (type === 'package' || title.includes('package') || title.includes('tour')) {
                invalidateData.packages();
              }
            });
            
            this.callbacks.forEach(cb => {
              try {
                cb(newNotifications);
              } catch (error) {
                // Ignore callback errors
              }
            });
          }
          
          this.lastNotificationCheck = new Date();
        }
      } catch (error) {
        // Silently handle polling errors - don't log timeouts
        if (!error.message || !error.message.includes('timeout')) {
          console.warn('[NotificationService] Polling error (non-timeout):', error.message);
        }
      }
    }, 45000);

    // Initial load with timeout handling
    this.getNotifications(userId).then(result => {
      if (result.success && callback) {
        callback(result.data || []);
      }
    }).catch(error => {
      // Handle initial load errors gracefully
      if (callback) {
        callback([]);
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
          const notification = payload.new;
          
          // Emit data change events for realtime notifications too
          const title = notification.title?.toLowerCase() || '';
          const type = notification.type?.toLowerCase() || '';
          
          if (type === 'booking' || title.includes('booking')) {
            invalidateData.bookings();
          }
          if (type === 'ride' || title.includes('ride')) {
            invalidateData.rides();
          }
          if (title.includes('earning') || title.includes('payment')) {
            invalidateData.earnings();
          }
          if (type === 'custom' || title.includes('custom')) {
            invalidateData.customRequests();
          }
          
          callback([notification]);
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
      
      const touristName = bookingData.tourist_name || bookingData.customer_name || 'A tourist';
      const packageName = bookingData.package_name || 'a tour';
      const paxCount = bookingData.number_of_pax || 1;
      const pickupTime = bookingData.pickup_time || '09:00';
      const bookingDate = bookingData.booking_date ? new Date(bookingData.booking_date).toLocaleDateString() : 'TBD';
      
      // Use the notification API directly - let the backend handle driver lookup
      const { apiBaseUrl } = await import('./networkConfig');
      
      // First, get all drivers to determine how many to notify
      let driverCount = 0;
      try {
        const { data: drivers } = await supabase
          .from('users')
          .select('id, status')
          .in('role', ['driver', 'driver-owner']);
        
        driverCount = drivers ? drivers.length : 0;
        const activeCount = drivers ? drivers.filter(d => d.status === 'active').length : 0;
        console.log(`[NotificationService] Found ${driverCount} total drivers (${activeCount} active, ${driverCount - activeCount} inactive)`);
        
        if (driverCount === 0) {
          console.log('[NotificationService] No drivers to notify');
          return { success: true, message: 'No drivers to notify' };
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
        
        // Send notification using the API
        const result = await this.sendNotification(
          driverIds,
          'New Booking Request! 🚗',
          `${touristName} needs a driver for ${packageName} (${paxCount} pax). Pickup: ${pickupTime} on ${bookingDate}. Tap to accept!`,
          'booking',
          'driver'
        );
        
        console.log('[NotificationService] Driver notification result:', result);
        return {
          ...result,
          drivers_found: driverCount,
          drivers_notified: driverIds.length
        };
        
      } catch (error) {
        console.error('[NotificationService] Error in driver notification:', error);
        return { success: false, error: error.message, drivers_found: driverCount };
      }
      
    } catch (error) {
      console.error('[NotificationService] Failed to notify drivers:', error);
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
  // Show immediate notification alert (disabled to prevent modal issues)
  static showNotificationAlert(title, message, onPress = null) {
    // Disabled - use local notifications instead
    console.log('[NotificationService] Alert:', title, message);
  }

  // Register for push notifications
  static async registerForPushNotifications() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        return null;
      }
      
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'b3c3eee0-8587-45cd-8170-992a4580d305'
      });
      
      this.pushToken = token.data;
      await this.storePushToken(token.data);
      
      return token.data;
    } catch (error) {
      return null;
    }
  }
  
  // Store push token in backend
  static async storePushToken(token) {
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      if (!userId) return;
      
      await networkClient.post('/notifications/store-token/', {
        user_id: userId,
        push_token: token,
        platform: Platform.OS
      });
    } catch (error) {
      console.error('Error storing push token:', error);
    }
  }

  // Send local notification
  static async sendLocalNotification(title, message, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        },
        trigger: null,
      });
    } catch (error) {
      // Ignore notification errors
    }
  }

  // Start location tracking for drivers
  static async startLocationTracking(userId, onLocationUpdate) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[NotificationService] Location permission denied');
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
          const { latitude, longitude, speed, heading } = location.coords;
          
          // Update location via API
          try {
            const { updateDriverLocation } = await import('./rideHailingService');
            await updateDriverLocation(userId, latitude, longitude, speed || 0, heading || 0);
            
            if (onLocationUpdate) {
              onLocationUpdate({ latitude, longitude, speed, heading });
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
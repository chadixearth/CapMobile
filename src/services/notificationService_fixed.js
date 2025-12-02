import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateData } from './dataInvalidationService';
import networkClient from './networkClient';
import ResponseHandler from './responseHandler';

class NotificationService {
  static pollingInterval = null;
  static lastNotificationCheck = null;
  static callbacks = new Set();
  static locationWatcher = null;
  static pushToken = null;
  static consecutiveFailures = 0;
  static maxFailures = 3;
  static backoffTime = 0;
  static isCircuitOpen = false;
  static processedNotifications = new Set();

  static async initialize() {
    try {
      console.log('[NotificationService] Initializing...');
      
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('[NotificationService] Permission not granted');
        return { success: false, error: 'Permission not granted' };
      }
      
      console.log('[NotificationService] Permissions granted');
      await this.registerForPushNotifications();
      
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] Init failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async getNotifications(userId) {
    try {
      if (!userId) {
        console.warn('[NotificationService] No user ID');
        return ResponseHandler.createSafeResponse([]);
      }
      
      console.log(`[NotificationService] Fetching for user: ${userId}`);
      
      const result = await networkClient.get(`/notifications/?user_id=${userId}`, {
        timeout: 10000,
        retries: 1
      });
      
      if (!result || !result.data) {
        return ResponseHandler.createSafeResponse([]);
      }
      
      const notifications = result.data?.data || result.data || [];
      console.log(`[NotificationService] Got ${notifications.length} notifications`);
      
      return ResponseHandler.createSafeResponse(notifications);
    } catch (error) {
      console.log('[NotificationService] Fetch error:', error?.message);
      return ResponseHandler.createSafeResponse([]);
    }
  }

  static async markAsRead(notificationId) {
    try {
      const result = await networkClient.put('/notifications/mark-read/', {
        notification_id: notificationId
      }, {
        timeout: 5000,
        retries: 0
      });
      return result?.data || { success: true };
    } catch (error) {
      console.log('[NotificationService] Mark read failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  static async startPolling(userId, callback) {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.callbacks.add(callback);
    console.log('[NotificationService] Starting polling for:', userId);
    
    try {
      this.registerForPushNotifications();
    } catch (error) {
      console.log('[NotificationService] Push registration failed:', error);
    }
    
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.type === 'booking') {
        callback([{ ...data, tapped: true }]);
      }
    });
    
    // Poll every 30 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        if (this.isCircuitOpen) {
          const now = Date.now();
          if (now < this.backoffTime) {
            console.log('[NotificationService] Circuit breaker open');
            return;
          } else {
            console.log('[NotificationService] Circuit breaker reset');
            this.isCircuitOpen = false;
            this.consecutiveFailures = 0;
          }
        }
        
        const result = await this.getNotifications(userId);
        if (result.success && result.data) {
          this.consecutiveFailures = 0;
          this.isCircuitOpen = false;
          
          const newNotifications = this.lastNotificationCheck 
            ? result.data.filter(n => {
                const notifTime = new Date(n.created_at);
                const notifKey = `${n.id}_${n.created_at}`;
                return notifTime > this.lastNotificationCheck && !n.read && !this.processedNotifications.has(notifKey);
              })
            : result.data.filter(n => {
                const notifKey = `${n.id}_${n.created_at}`;
                return !n.read && !this.processedNotifications.has(notifKey);
              }).slice(0, 3);
          
          if (newNotifications.length > 0) {
            console.log(`[NotificationService] Got ${newNotifications.length} new notifications`);
            
            for (const notif of newNotifications) {
              await this.sendLocalNotification(
                notif.title,
                notif.message,
                { type: notif.type, id: notif.id, notificationId: notif.id }
              );
            }
            
            newNotifications.forEach(notif => {
              const title = notif.title?.toLowerCase() || '';
              const type = notif.type?.toLowerCase() || '';
              
              if (type === 'booking' || title.includes('booking')) {
                invalidateData.bookings();
              }
              if (type === 'ride' || title.includes('ride')) {
                invalidateData.rides();
              }
              if (title.includes('earning') || title.includes('payment')) {
                invalidateData.earnings();
              }
            });
            
            newNotifications.forEach(n => {
              const notifKey = `${n.id}_${n.created_at}`;
              this.processedNotifications.add(notifKey);
            });
            
            if (this.processedNotifications.size > 100) {
              const processedArray = Array.from(this.processedNotifications);
              this.processedNotifications = new Set(processedArray.slice(-100));
            }
            
            this.callbacks.forEach(cb => {
              try {
                cb(newNotifications);
              } catch (error) {
                console.log('[NotificationService] Callback error:', error);
              }
            });
          }
          
          this.lastNotificationCheck = new Date();
        }
      } catch (error) {
        this.consecutiveFailures++;
        
        if (this.consecutiveFailures >= this.maxFailures) {
          this.isCircuitOpen = true;
          this.backoffTime = Date.now() + (60000 * Math.pow(2, Math.min(this.consecutiveFailures - this.maxFailures, 3)));
          console.log(`[NotificationService] Circuit breaker opened`);
        }
      }
    }, 30000);

    // Initial load
    this.getNotifications(userId).then(result => {
      if (result.success && callback) {
        callback(result.data || []);
      }
    }).catch(error => {
      console.log('[NotificationService] Initial load failed');
      if (callback) {
        callback([]);
      }
    });
  }

  static stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.callbacks.clear();
  }

  static async sendLocalNotification(title, message, data = {}) {
    try {
      console.log('[NotificationService] Sending local notification:', title);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'New Notification',
          body: message || 'You have a new notification',
          data: { ...data, timestamp: Date.now() },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
          badge: 1,
        },
        trigger: null,
      });
      
      console.log('[NotificationService] Local notification sent:', title);
    } catch (error) {
      console.error('[NotificationService] Local notification failed:', error.message);
    }
  }

  static async registerForPushNotifications() {
    try {
      console.log('[NotificationService] Registering for push...');
      
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'b3c3eee0-8587-45cd-8170-992a4580d305',
      });
      
      if (token) {
        console.log('[NotificationService] Got push token');
        this.pushToken = token.data;
        
        await this.storePushToken(token.data);
        return token.data;
      }
      
      return null;
    } catch (error) {
      console.log('[NotificationService] Push registration failed:', error.message);
      return null;
    }
  }

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
      console.error('[NotificationService] Store token error:', error);
    }
  }

  static async notifyDriversOfNewBooking(bookingData) {
    try {
      console.log('[NotificationService] Notifying drivers of booking:', bookingData.id);
      
      const touristName = bookingData.tourist_name || bookingData.customer_name || 'A tourist';
      const packageName = bookingData.package_name || 'a tour';
      const paxCount = bookingData.number_of_pax || 1;
      const pickupTime = bookingData.pickup_time || '09:00';
      const bookingDate = bookingData.booking_date ? new Date(bookingData.booking_date).toLocaleDateString() : 'TBD';
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [], // Backend will handle driver lookup
        title: 'New Booking Request! 🚗',
        message: `${touristName} needs a driver for ${packageName} (${paxCount} pax). Pickup: ${pickupTime} on ${bookingDate}. Tap to accept!`,
        type: 'booking',
        role: 'driver'
      });
      
      console.log('[NotificationService] Driver notification result:', result);
      return result;
      
    } catch (error) {
      console.error('[NotificationService] Driver notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async notifyTouristOfAcceptedBooking(touristId, driverName, bookingData) {
    try {
      console.log('[NotificationService] Notifying tourist of acceptance');
      
      if (!touristId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(touristId)) {
        console.warn('[NotificationService] Invalid tourist ID:', touristId);
        return { success: false, error: 'Invalid tourist ID' };
      }
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [touristId],
        title: 'Booking Accepted! ✅',
        message: `Great news! ${driverName || 'A driver'} has accepted your booking. Get ready for your tour!`,
        type: 'booking',
        role: 'tourist'
      });
      
      console.log('[NotificationService] Tourist notification result:', result);
      return result;
    } catch (error) {
      console.error('[NotificationService] Tourist notification failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default NotificationService;

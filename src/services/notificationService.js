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

  static async markAllAsRead(userId, notifications) {
    try {
      if (!notifications || notifications.length === 0) {
        return { success: true, message: 'No notifications to mark' };
      }
      
      const notificationIds = notifications.map(n => n.id);
      const result = await networkClient.put('/notifications/mark-all-read/', {
        user_id: userId,
        notification_ids: notificationIds
      }, {
        timeout: 10000,
        retries: 2
      });
      
      if (result?.success) {
        return result.data || { success: true };
      }
      
      return { success: false, error: result?.error || 'Failed to mark all as read' };
    } catch (error) {
      console.log('[NotificationService] Mark all read failed:', error?.message || 'Unknown error');
      return { success: false, error: error?.message || 'Unknown error' };
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
        user_ids: [],
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

  static async notifyTouristOfCancelledBooking(touristId, reason, bookingData) {
    try {
      console.log('[NotificationService] Notifying tourist of cancellation');
      
      if (!touristId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(touristId)) {
        console.warn('[NotificationService] Invalid tourist ID:', touristId);
        return { success: false, error: 'Invalid tourist ID' };
      }
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [touristId],
        title: 'Booking Cancelled ❌',
        message: `Your booking has been cancelled. ${reason || 'Please contact support for more details.'}`,
        type: 'booking',
        role: 'tourist'
      });
      
      console.log('[NotificationService] Cancellation notification result:', result);
      return result;
    } catch (error) {
      console.error('[NotificationService] Cancellation notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async notifyOwnersOfNewSpecialEvent(eventData) {
    try {
      console.log('[NotificationService] Notifying owners of special event:', eventData.id);
      
      const customerName = eventData.customer_name || 'A customer';
      const eventType = eventData.event_type || 'special event';
      const paxCount = eventData.number_of_pax || 1;
      const eventDate = eventData.event_date ? new Date(eventData.event_date).toLocaleDateString() : 'TBD';
      const eventTime = eventData.event_time || 'TBD';
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [],
        title: 'New Special Event Request! 🎉',
        message: `${customerName} needs a carriage for ${eventType} (${paxCount} pax). Date: ${eventDate} at ${eventTime}. Tap to accept!`,
        type: 'booking',
        role: 'owner'
      });
      
      console.log('[NotificationService] Owner notification result:', result);
      return result;
      
    } catch (error) {
      console.error('[NotificationService] Owner notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async notifyOwnerOfCarriageIssue(ownerId, carriageData, issueType, description) {
    try {
      console.log('[NotificationService] Notifying owner of carriage issue:', carriageData.id);
      
      const carriageName = carriageData.carriage_code || carriageData.code || `TC${carriageData.id}`;
      const driverName = carriageData.driver_name || carriageData.assigned_driver || 'Driver';
      
      let title, message;
      switch (issueType) {
        case 'maintenance':
          title = 'Carriage Maintenance Required 🔧';
          message = `${carriageName} needs maintenance. Driver ${driverName} reported: ${description}. Please schedule service.`;
          break;
        case 'accident':
          title = 'Carriage Incident Report ⚠️';
          message = `${carriageName} was involved in an incident. Driver ${driverName} is safe. Details: ${description}. Please contact driver.`;
          break;
        case 'breakdown':
          title = 'Carriage Breakdown 🚫';
          message = `${carriageName} has broken down. Driver ${driverName} needs assistance. Location: ${description}. Please provide support.`;
          break;
        default:
          title = 'Carriage Issue Report 📋';
          message = `${carriageName} has an issue reported by ${driverName}. Details: ${description}. Please review.`;
      }
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [ownerId],
        title: title,
        message: message,
        type: 'booking',
        role: 'owner'
      });
      
      console.log('[NotificationService] Owner carriage issue notification result:', result);
      return result;
    } catch (error) {
      console.error('[NotificationService] Carriage issue notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async notifyOwnerOfPaymentReceived(ownerId, bookingData, paymentAmount) {
    try {
      console.log('[NotificationService] Notifying owner of payment received:', bookingData.id);
      
      const customerName = bookingData.customer_name || 'Customer';
      const packageName = bookingData.package_name || 'tour';
      const carriageName = bookingData.carriage_code || 'your carriage';
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [ownerId],
        title: 'Payment Received! 💰',
        message: `Payment of ₱${paymentAmount.toLocaleString()} received from ${customerName} for ${packageName} using ${carriageName}. Earnings will be processed.`,
        type: 'payment',
        role: 'owner'
      });
      
      console.log('[NotificationService] Owner payment notification result:', result);
      return result;
    } catch (error) {
      console.error('[NotificationService] Payment notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async notifyOwnerOfDriverPerformance(ownerId, driverData, performanceIssue) {
    try {
      console.log('[NotificationService] Notifying owner of driver performance issue:', driverData.id);
      
      const driverName = driverData.name || driverData.driver_name || 'Driver';
      const carriageName = driverData.carriage_code || 'assigned carriage';
      
      let title, message;
      switch (performanceIssue.type) {
        case 'cancellation_rate':
          title = 'Driver Performance Alert 📊';
          message = `${driverName} (${carriageName}) has a high cancellation rate: ${performanceIssue.rate}%. Consider reviewing their performance.`;
          break;
        case 'customer_complaint':
          title = 'Customer Complaint 📝';
          message = `Customer complaint received about ${driverName} (${carriageName}). Reason: ${performanceIssue.reason}. Please address with driver.`;
          break;
        case 'late_arrivals':
          title = 'Punctuality Issue ⏰';
          message = `${driverName} (${carriageName}) has been frequently late. Recent incidents: ${performanceIssue.count}. Please discuss punctuality.`;
          break;
        default:
          title = 'Driver Performance Notice 📋';
          message = `Performance issue noted for ${driverName} (${carriageName}). Details: ${performanceIssue.description}. Please review.`;
      }
      
      const result = await networkClient.post('/notifications/', {
        user_ids: [ownerId],
        title: title,
        message: message,
        type: 'booking',
        role: 'owner'
      });
      
      console.log('[NotificationService] Owner driver performance notification result:', result);
      return result;
    } catch (error) {
      console.error('[NotificationService] Driver performance notification failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default NotificationService;

import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateData } from './dataInvalidationService';
import networkClient from './networkClient';
import ResponseHandler from './responseHandler';

// Configure notification behavior (moved to initialize method)

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

  // Initialize notification service
  static async initialize() {
    try {
      console.log('[NotificationService] Initializing notification service...');
      
      // Setup notification configuration
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('[NotificationService] Notification permission not granted');
        return { success: false, error: 'Permission not granted' };
      }
      
      console.log('[NotificationService] Notification permissions granted');
      
      // Register for push notifications
      await this.registerForPushNotifications();
      
      console.log('[NotificationService] Notification service initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] Failed to initialize:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to backend
  static async sendNotification(userIds, title, message, type = 'info', role = 'tourist') {
    try {
      const result = await networkClient.post('/notifications/', {
        user_ids: Array.isArray(userIds) ? userIds : [userIds],
        title,
        message,
        type,
        role
      }, {
        timeout: 8000,
        retries: 0
      });
      
      return result.data;
    } catch (error) {
      console.log('[NotificationService] Send notification failed:', error.message);
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
      
      // Direct API call to notifications endpoint
      const result = await networkClient.get(`/notifications/?user_id=${userId}`, {
        timeout: 10000,
        retries: 1
      });
      
      // Ensure result has proper structure
      if (!result || !result.data) {
        return ResponseHandler.createSafeResponse([]);
      }
      
      const notifications = result.data?.data || result.data || [];
      
      return ResponseHandler.createSafeResponse(notifications);
    } catch (error) {
      // Handle different types of errors gracefully
      const errorMessage = error?.message || 'Unknown error';
      
      if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        console.log('[NotificationService] Request timeout - backend may be slow');
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        console.log('[NotificationService] Notification endpoint not found - feature may not be implemented');
      } else if (errorMessage.includes('500')) {
        console.log('[NotificationService] Backend server error - notifications temporarily unavailable');
      } else if (errorMessage.includes('Network request failed')) {
        console.log('[NotificationService] Network connection failed - notifications unavailable');
      } else {
        console.log('[NotificationService] Network error:', errorMessage);
      }
      return ResponseHandler.createSafeResponse([]);
    }
  }

  // Mark notification as read
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
      console.log('[NotificationService] Mark as read failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId = null, notifications = []) {
    try {
      console.log(`[NotificationService] Marking all notifications as read for user: ${userId}`);
      
      if (!notifications || notifications.length === 0) {
        console.log('[NotificationService] No notifications to mark as read');
        return { success: true };
      }
      
      // Mark each unread notification individually since bulk endpoint doesn't exist
      const unreadNotifications = notifications.filter(n => !n.read);
      console.log(`[NotificationService] Found ${unreadNotifications.length} unread notifications to mark`);
      
      if (unreadNotifications.length === 0) {
        return { success: true };
      }
      
      // Mark each notification as read
      const results = await Promise.allSettled(
        unreadNotifications.map(notification => 
          this.markAsRead(notification.id)
        )
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success !== false).length;
      console.log(`[NotificationService] Marked ${successCount}/${unreadNotifications.length} notifications as read`);
      
      return { success: true, marked: successCount, total: unreadNotifications.length };
    } catch (error) {
      console.log('[NotificationService] Mark all as read failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Start real-time polling for notifications
  static async startPolling(userId, callback) {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.callbacks.add(callback);
    
    console.log('[NotificationService] Starting notification polling for user:', userId);
    
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
    
    // Poll every 30 seconds to reduce excessive calls
    this.pollingInterval = setInterval(async () => {
      try {
        // Check circuit breaker
        if (this.isCircuitOpen) {
          const now = Date.now();
          if (now < this.backoffTime) {
            console.log('[NotificationService] Circuit breaker open, skipping poll');
            return;
          } else {
            console.log('[NotificationService] Circuit breaker reset, attempting poll');
            this.isCircuitOpen = false;
            this.consecutiveFailures = 0;
          }
        }
        
        const result = await this.getNotifications(userId);
        if (result.success && result.data) {
          // Reset failure count on success
          this.consecutiveFailures = 0;
          this.isCircuitOpen = false;
          // Only get truly new notifications (not just unread ones)
          const newNotifications = this.lastNotificationCheck 
            ? result.data.filter(n => {
                const notifTime = new Date(n.created_at);
                const notifKey = `${n.id}_${n.created_at}`;
                return notifTime > this.lastNotificationCheck && !n.read && !this.processedNotifications.has(notifKey);
              })
            : result.data.filter(n => {
                const notifKey = `${n.id}_${n.created_at}`;
                return !n.read && !this.processedNotifications.has(notifKey);
              }).slice(0, 3); // Limit initial load to 3 most recent
          
          if (newNotifications.length > 0) {
            // Send local notifications for all new notifications
            for (const notif of newNotifications) {
              await this.sendLocalNotification(
                notif.title,
                notif.message,
                { type: notif.type, id: notif.id, notificationId: notif.id }
              );
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
              // Handle announcements - no specific data invalidation needed
              if (type === 'announcement' || title.includes('announcement')) {
                console.log('[NotificationService] Received announcement:', title);
              }
            });
            
            // Mark notifications as processed
            newNotifications.forEach(n => {
              const notifKey = `${n.id}_${n.created_at}`;
              this.processedNotifications.add(notifKey);
            });
            
            // Clean up old processed notifications (keep only last 100)
            if (this.processedNotifications.size > 100) {
              const processedArray = Array.from(this.processedNotifications);
              this.processedNotifications = new Set(processedArray.slice(-100));
            }
            
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
        // Increment failure count
        this.consecutiveFailures++;
        
        const errorMessage = error?.message || 'Unknown error';
        
        // Open circuit breaker if too many failures
        if (this.consecutiveFailures >= this.maxFailures) {
          this.isCircuitOpen = true;
          this.backoffTime = Date.now() + (60000 * Math.pow(2, Math.min(this.consecutiveFailures - this.maxFailures, 3))); // Exponential backoff up to 8 minutes
          console.log(`[NotificationService] Circuit breaker opened after ${this.consecutiveFailures} failures, backing off until ${new Date(this.backoffTime).toLocaleTimeString()}`);
        } else {
          // Only log non-timeout errors and not too frequently
          if (!errorMessage.includes('timeout') && !errorMessage.includes('Network request failed')) {
            console.log(`[NotificationService] Polling error (${this.consecutiveFailures}/${this.maxFailures}):`, errorMessage);
          }
        }
      }
    }, 30000); // 30 seconds to reduce excessive calls

    // Initial load with timeout handling
    this.getNotifications(userId).then(result => {
      if (result.success && callback) {
        callback(result.data || []);
      }
    }).catch(error => {
      // Handle initial load errors gracefully
      console.log('[NotificationService] Initial notification load failed, continuing with empty state');
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
  
  // Reset circuit breaker (for manual recovery)
  static resetCircuitBreaker() {
    this.consecutiveFailures = 0;
    this.isCircuitOpen = false;
    this.backoffTime = 0;
    console.log('[NotificationService] Circuit breaker manually reset');
  }
  
  // Check notification service health
  static async checkHealth() {
    return {
      endpoint_available: true,
      circuit_open: this.isCircuitOpen,
      consecutive_failures: this.consecutiveFailures,
      backoff_until: this.backoffTime > Date.now() ? new Date(this.backoffTime).toLocaleTimeString() : null,
      polling_active: !!this.pollingInterval,
      push_token: this.pushToken ? 'Available' : 'Not available'
    };
  }
  
  // Test notification system
  static async testNotification() {
    try {
      console.log('[NotificationService] Testing notification system...');
      
      // Send a test local notification
      await this.sendLocalNotification(
        'Test Notification',
        'This is a test notification to verify the system is working.',
        { type: 'test', timestamp: Date.now() }
      );
      
      return { success: true, message: 'Test notification sent' };
    } catch (error) {
      console.error('[NotificationService] Test notification failed:', error);
      return { success: false, error: error.message };
    }
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

  // Notify all owners when someone books a special event
  static async notifyOwnersOfNewSpecialEvent(eventData) {
    try {
      console.log('[NotificationService] Notifying owners of new special event:', eventData.id || 'new event');
      
      const customerName = eventData.customer_name || 'A customer';
      const eventType = eventData.event_type || 'special event';
      const paxCount = eventData.number_of_pax || 1;
      const eventDate = eventData.event_date ? new Date(eventData.event_date).toLocaleDateString() : 'TBD';
      const eventTime = eventData.event_time || 'TBD';
      
      // Get all owners to notify
      let ownerCount = 0;
      try {
        const { data: owners } = await supabase
          .from('users')
          .select('id, status')
          .in('role', ['owner', 'driver-owner']);
        
        ownerCount = owners ? owners.length : 0;
        const activeCount = owners ? owners.filter(o => o.status === 'active').length : 0;
        console.log(`[NotificationService] Found ${ownerCount} total owners (${activeCount} active, ${ownerCount - activeCount} inactive)`);
        
        if (ownerCount === 0) {
          console.log('[NotificationService] No owners to notify');
          return { success: true, message: 'No owners to notify' };
        }
        
        const ownerIds = owners.map(o => o.id).filter(id => {
          try {
            // Validate UUID format
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          } catch {
            return false;
          }
        });
        
        if (ownerIds.length === 0) {
          console.log('[NotificationService] No valid owner UUIDs found');
          return { success: true, message: 'No valid owners to notify' };
        }
        
        // Send notification using the API
        const result = await this.sendNotification(
          ownerIds,
          'New Special Event Request! 🎉',
          `${customerName} needs a carriage for ${eventType} (${paxCount} pax). Date: ${eventDate} at ${eventTime}. Tap to accept!`,
          'booking',
          'owner'
        );
        
        console.log('[NotificationService] Owner notification result:', result);
        return {
          ...result,
          owners_found: ownerCount,
          owners_notified: ownerIds.length
        };
        
      } catch (error) {
        console.error('[NotificationService] Error in owner notification:', error);
        return { success: false, error: error.message, owners_found: ownerCount };
      }
      
    } catch (error) {
      console.error('[NotificationService] Failed to notify owners:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify owner when their carriage has an issue
  static async notifyOwnerOfCarriageIssue(ownerId, carriageData, issueType, description) {
    try {
      console.log('[NotificationService] Notifying owner of carriage issue:', carriageData.id || 'carriage');
      
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
      
      const result = await this.sendNotification(
        [ownerId],
        title,
        message,
        'booking',
        'owner'
      );
      
      console.log('[NotificationService] Owner carriage issue notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify owner of carriage issue:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify owner when payment is received for their carriage
  static async notifyOwnerOfPaymentReceived(ownerId, bookingData, paymentAmount) {
    try {
      console.log('[NotificationService] Notifying owner of payment received:', bookingData.id || 'booking');
      
      const customerName = bookingData.customer_name || 'Customer';
      const packageName = bookingData.package_name || 'tour';
      const carriageName = bookingData.carriage_code || 'your carriage';
      
      const result = await this.sendNotification(
        [ownerId],
        'Payment Received! 💰',
        `Payment of ₱${paymentAmount.toLocaleString()} received from ${customerName} for ${packageName} using ${carriageName}. Earnings will be processed.`,
        'payment',
        'owner'
      );
      
      console.log('[NotificationService] Owner payment notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify owner of payment:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify owner when their driver performance is concerning
  static async notifyOwnerOfDriverPerformance(ownerId, driverData, performanceIssue) {
    try {
      console.log('[NotificationService] Notifying owner of driver performance issue:', driverData.id || 'driver');
      
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
      
      const result = await this.sendNotification(
        [ownerId],
        title,
        message,
        'booking',
        'owner'
      );
      
      console.log('[NotificationService] Owner driver performance notification result:', result);
      return result;
    } catch (error) {
      console.error('Failed to notify owner of driver performance:', error);
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
      console.log('[NotificationService] Registering for push notifications...');
      
      // Get push token for Expo notifications
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'b3c3eee0-8587-45cd-8170-992a4580d305',
      });
      
      if (token) {
        console.log('[NotificationService] Got Expo push token:', token.data.substring(0, 20) + '...');
        this.pushToken = token.data;
        
        // Store token in backend
        await this.storePushToken(token.data);
        
        return token.data;
      } else {
        console.log('[NotificationService] Failed to get push token');
        return null;
      }
    } catch (error) {
      console.log('[NotificationService] Push notification registration failed:', error.message);
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

  // Send local notification with better formatting
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
      
      console.log('[NotificationService] Local notification sent successfully:', title);
    } catch (error) {
      console.error('[NotificationService] Local notification failed:', error.message);
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

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.log('[NotificationService] Location services disabled');
        return false;
      }

      // Start watching location
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 50, // Update every 50 meters
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
            console.log('Error updating location:', error);
          }
        }
      );
      
      return true;
    } catch (error) {
      console.log('Location tracking failed silently:', error.message);
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
        console.log('Location permission not granted');
        return null;
      }

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.log('Location services disabled');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.log('Error getting current location:', error.message);
      return null;
    }
  }


}

export default NotificationService;
// services/breakeven.js
import NotificationService from './notificationService';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

class BreakevenNotificationManager {
  static lastNotificationCheck = null;
  static notificationThresholds = {
    profitMilestones: [500, 1000, 2000, 5000], // Notify at these profit levels
    deficitWarningThreshold: 200, // Warn when deficit exceeds this amount
  };
  static dismissedNotifications = new Set(); // Track dismissed notifications
  static scheduledTimes = [12, 22]; // 12 PM (noon) and 10 PM
  static lastNotificationTimes = new Map(); // Track last notification time for each driver

  /**
   * Mark that notification was sent at this time
   */
  static markNotificationSent(driverId) {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toDateString();
    const notifKey = `${driverId}_${today}_${currentHour}`;
    
    this.lastNotificationTimes.set(notifKey, now.getTime());
  }

  /**
   * Check if driver has reached breakeven milestones and send notifications
   */
  static async checkBreakevenMilestones(driverId, currentData, previousData = null) {
    try {
      if (!driverId || !currentData) return;

      const expenses = parseFloat(currentData.expenses || 0);
      const revenue = parseFloat(currentData.revenue_period || 0);
      const profit = revenue - expenses;
      const ridesCompleted = parseInt(currentData.total_bookings || 0);
      const ridesNeeded = parseInt(currentData.bookings_needed || 0);

      // Skip if no meaningful data
      if (expenses <= 0) return;

      // Check if notifications are dismissed for today
      const today = new Date().toDateString();
      const dismissKey = `${driverId}_${today}`;
      if (this.dismissedNotifications.has(dismissKey)) {
        return; // Skip if dismissed for today
      }

      // This method is now only called by the notification scheduler
      // Send daily breakeven summary notification
      await this.sendDailyBreakevenSummary(driverId, {
        expenses,
        revenue,
        profit,
        ridesCompleted,
        ridesNeeded
      });

      // Mark notification as sent for this time slot
      this.markNotificationSent(driverId);

      // Store current state for next comparison
      try {
        await AsyncStorage.setItem(`breakeven_last_${driverId}`, JSON.stringify({
          expenses,
          revenue,
          profit,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to store breakeven state:', e);
      }

    } catch (error) {
      console.error('Error checking breakeven milestones:', error);
    }
  }

  /**
   * Send daily breakeven summary notification
   */
  static async sendDailyBreakevenSummary(driverId, data) {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      let title, message;
      
      if (currentHour === 12) {
        // 12 PM - Midday update
        if (data.profit >= 0) {
          title = '🎯 Midday Update: On Track!';
          message = `Great progress! You've earned ₱${data.revenue.toLocaleString()} so far today. You're ${data.profit >= 0 ? 'at breakeven' : '₱' + Math.abs(data.profit).toLocaleString() + ' from breakeven'}. Keep it up!`;
        } else {
          const remaining = Math.abs(data.profit);
          const ridesLeft = Math.max(0, data.ridesNeeded - data.ridesCompleted);
          title = '📊 Midday Update';
          message = `You've completed ${data.ridesCompleted} rides today. Need ₱${remaining.toLocaleString()} more to reach breakeven (about ${ridesLeft} more rides). You're making progress!`;
        }
      } else if (currentHour === 22) {
        // 10 PM - End of day summary
        if (data.profit > 0) {
          title = '🌟 Daily Summary: Profitable Day!';
          message = `Excellent work today! You earned ₱${data.profit.toLocaleString()} profit with ${data.ridesCompleted} rides. Revenue: ₱${data.revenue.toLocaleString()}, Expenses: ₱${data.expenses.toLocaleString()}.`;
        } else if (data.profit === 0) {
          title = '🎯 Daily Summary: Breakeven Achieved!';
          message = `Perfect! You hit breakeven today with ${data.ridesCompleted} rides. Revenue: ₱${data.revenue.toLocaleString()} exactly covered your expenses.`;
        } else {
          const deficit = Math.abs(data.profit);
          title = '📊 Daily Summary';
          message = `Today's summary: ${data.ridesCompleted} rides, ₱${data.revenue.toLocaleString()} revenue. You're ₱${deficit.toLocaleString()} from breakeven. Tomorrow's a new opportunity!`;
        }
      } else {
        return; // Don't send notifications at other times
      }
      
      await NotificationService.sendNotification(
        [driverId],
        title,
        message,
        'breakeven',
        'driver'
      );

      // Show local notification immediately
      await NotificationService.sendLocalNotification(title, message, {
        type: 'breakeven_summary',
        time: currentHour === 12 ? 'midday' : 'evening',
        driverId
      });

    } catch (error) {
      console.error('Error sending daily breakeven summary:', error);
    }
  }

  /**
   * Get recent breakeven notifications for a driver
   */
  static async getRecentBreakevenNotifications(driverId) {
    try {
      const result = await supabase
        .from('notification_recipients')
        .select(`
          id,
          created_at,
          is_read,
          notifications (
            id,
            title,
            message,
            type,
            created_at
          )
        `)
        .eq('user_id', driverId)
        .eq('role', 'driver')
        .order('created_at', { ascending: false })
        .limit(20);

      if (result.error) {
        console.error('Error fetching breakeven notifications:', result.error);
        return [];
      }

      // Filter for breakeven-related notifications
      const breakevenNotifications = (result.data || []).filter(item => {
        const notif = item.notifications;
        if (!notif) return false;
        
        const title = notif.title.toLowerCase();
        const message = notif.message.toLowerCase();
        
        return title.includes('breakeven') || 
               title.includes('profit') || 
               title.includes('milestone') ||
               message.includes('breakeven') ||
               message.includes('deficit');
      });

      return breakevenNotifications.map(item => ({
        id: item.id,
        title: item.notifications.title,
        message: item.notifications.message,
        type: item.notifications.type,
        read: item.is_read,
        created_at: item.created_at
      }));

    } catch (error) {
      console.error('Error getting recent breakeven notifications:', error);
      return [];
    }
  }

  /**
   * Clear old breakeven state (call when driver starts new day/period)
   */
  static async clearBreakevenState(driverId) {
    try {
      await AsyncStorage.removeItem(`breakeven_last_${driverId}`);
      // Clear dismissed notifications for new day
      const today = new Date().toDateString();
      const dismissKey = `${driverId}_${today}`;
      this.dismissedNotifications.delete(dismissKey);
      
      // Clear old notification times (keep only today's)
      const keysToDelete = [];
      for (const [key] of this.lastNotificationTimes) {
        if (!key.includes(today)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.lastNotificationTimes.delete(key));
    } catch (error) {
      console.warn('Failed to clear breakeven state:', error);
    }
  }

  /**
   * Dismiss notifications for today
   */
  static dismissNotificationsForToday(driverId) {
    const today = new Date().toDateString();
    const dismissKey = `${driverId}_${today}`;
    this.dismissedNotifications.add(dismissKey);
    
    // Also clear notification times for today to prevent further notifications
    const currentHour = new Date().getHours();
    const notifKey = `${driverId}_${today}_${currentHour}`;
    this.lastNotificationTimes.set(notifKey, Date.now());
  }

  /**
   * Check if notifications are dismissed for today
   */
  static areNotificationsDismissedForToday(driverId) {
    const today = new Date().toDateString();
    const dismissKey = `${driverId}_${today}`;
    return this.dismissedNotifications.has(dismissKey);
  }
}

export default BreakevenNotificationManager;
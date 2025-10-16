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

      // Get previous state from storage if not provided
      if (!previousData) {
        try {
          const stored = await AsyncStorage.getItem(`breakeven_last_${driverId}`);
          previousData = stored ? JSON.parse(stored) : null;
        } catch (e) {
          previousData = null;
        }
      }

      const previousProfit = previousData ? (parseFloat(previousData.revenue || 0) - parseFloat(previousData.expenses || 0)) : -1;
      const wasBreakeven = previousProfit >= 0;
      const wasProfitable = previousProfit > 0;

      // Check for breakeven achievement
      if (profit >= 0 && !wasBreakeven) {
        await this.sendBreakevenAchievedNotification(driverId, {
          expenses,
          revenue,
          ridesCompleted,
          ridesNeeded
        });
      }

      // Check for profit achievement
      if (profit > 0 && !wasProfitable) {
        await this.sendProfitAchievedNotification(driverId, {
          profit,
          revenue,
          expenses
        });
      }

      // Check for profit milestones
      if (profit > 0) {
        const currentMilestone = this.notificationThresholds.profitMilestones.find(
          milestone => profit >= milestone && (previousProfit < milestone || previousProfit <= 0)
        );
        
        if (currentMilestone) {
          await this.sendProfitMilestoneNotification(driverId, {
            milestone: currentMilestone,
            actualProfit: profit
          });
        }
      }

      // Check for deficit warning (only once per day)
      if (profit < 0 && ridesCompleted > 0) {
        const deficit = Math.abs(profit);
        if (deficit >= this.notificationThresholds.deficitWarningThreshold) {
          const lastDeficitWarning = await AsyncStorage.getItem(`deficit_warning_${driverId}_${today}`);
          if (!lastDeficitWarning) {
            await this.sendDeficitWarningNotification(driverId, {
              deficit,
              ridesRemaining: Math.max(0, ridesNeeded - ridesCompleted),
              expenses
            });
            await AsyncStorage.setItem(`deficit_warning_${driverId}_${today}`, Date.now().toString());
          }
        }
      }

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
   * Send breakeven achieved notification
   */
  static async sendBreakevenAchievedNotification(driverId, data) {
    try {
      const title = '🎯 Breakeven Achieved!';
      const message = `Great job! You've reached your breakeven point with ₱${data.revenue.toLocaleString()} revenue covering ₱${data.expenses.toLocaleString()} expenses. You completed ${data.ridesCompleted} out of ${data.ridesNeeded} needed rides.`;
      
      await NotificationService.sendNotification(
        [driverId],
        title,
        message,
        'breakeven',
        'driver'
      );

      // Show local notification immediately
      await NotificationService.sendLocalNotification(title, message, {
        type: 'breakeven',
        driverId
      });

    } catch (error) {
      console.error('Error sending breakeven achieved notification:', error);
    }
  }

  /**
   * Send profit achieved notification
   */
  static async sendProfitAchievedNotification(driverId, data) {
    try {
      const title = '💰 You\'re Now Profitable!';
      const message = `Excellent! You're now earning profit of ₱${data.profit.toLocaleString()}. Your revenue (₱${data.revenue.toLocaleString()}) exceeds your expenses (₱${data.expenses.toLocaleString()}). Keep up the great work!`;
      
      await NotificationService.sendNotification(
        [driverId],
        title,
        message,
        'profit',
        'driver'
      );

      // Show local notification immediately
      await NotificationService.sendLocalNotification(title, message, {
        type: 'profit',
        driverId
      });

    } catch (error) {
      console.error('Error sending profit achieved notification:', error);
    }
  }

  /**
   * Send profit milestone notification
   */
  static async sendProfitMilestoneNotification(driverId, data) {
    try {
      const title = `🏆 ₱${data.milestone.toLocaleString()} Profit Milestone!`;
      const message = `Amazing achievement! You've reached ₱${data.milestone.toLocaleString()} in profit (actual: ₱${data.actualProfit.toLocaleString()}). Your hard work is paying off!`;
      
      await NotificationService.sendNotification(
        [driverId],
        title,
        message,
        'milestone',
        'driver'
      );

      // Show local notification immediately
      await NotificationService.sendLocalNotification(title, message, {
        type: 'milestone',
        milestone: data.milestone,
        driverId
      });

    } catch (error) {
      console.error('Error sending profit milestone notification:', error);
    }
  }

  /**
   * Send deficit warning notification
   */
  static async sendDeficitWarningNotification(driverId, data) {
    try {
      const title = '📊 Breakeven Update';
      const message = `You're ₱${data.deficit.toLocaleString()} away from breakeven. Complete about ${data.ridesRemaining} more rides to cover your ₱${data.expenses.toLocaleString()} expenses. You're making progress!`;
      
      await NotificationService.sendNotification(
        [driverId],
        title,
        message,
        'update',
        'driver'
      );

      // Show local notification immediately
      await NotificationService.sendLocalNotification(title, message, {
        type: 'deficit_warning',
        deficit: data.deficit,
        driverId
      });

    } catch (error) {
      console.error('Error sending deficit warning notification:', error);
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
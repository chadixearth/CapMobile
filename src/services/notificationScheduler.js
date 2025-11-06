// services/notificationScheduler.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import BreakevenNotificationManager from './breakeven';

class NotificationScheduler {
  static scheduledTimes = [12, 22]; // 12 PM and 10 PM
  static activeSchedules = new Map(); // Track active schedules per driver
  static isInitialized = false;

  /**
   * Initialize the notification scheduler
   */
  static async initialize() {
    if (this.isInitialized) return;
    
    console.log('[NotificationScheduler] Initializing notification scheduler...');
    this.isInitialized = true;
    
    // Clean up any old schedules on app start
    this.activeSchedules.clear();
  }

  /**
   * Start scheduled notifications for a driver
   */
  static startScheduledNotifications(driverId) {
    if (!driverId) return;
    
    // Clear any existing schedule for this driver
    this.stopScheduledNotifications(driverId);
    
    console.log(`[NotificationScheduler] Starting scheduled notifications for driver: ${driverId}`);
    
    // Schedule notifications for both times
    const scheduleIds = [];
    
    this.scheduledTimes.forEach(hour => {
      const scheduleId = this.scheduleNotificationAtTime(driverId, hour);
      if (scheduleId) {
        scheduleIds.push(scheduleId);
      }
    });
    
    this.activeSchedules.set(driverId, scheduleIds);
  }

  /**
   * Stop scheduled notifications for a driver
   */
  static stopScheduledNotifications(driverId) {
    if (!driverId) return;
    
    const scheduleIds = this.activeSchedules.get(driverId);
    if (scheduleIds) {
      scheduleIds.forEach(id => {
        if (id) clearTimeout(id);
      });
      this.activeSchedules.delete(driverId);
      console.log(`[NotificationScheduler] Stopped scheduled notifications for driver: ${driverId}`);
    }
  }

  /**
   * Schedule a notification at a specific hour
   */
  static scheduleNotificationAtTime(driverId, targetHour) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Calculate next occurrence of target hour
    let nextNotification = new Date();
    nextNotification.setHours(targetHour, 0, 0, 0); // Set to target hour, 0 minutes, 0 seconds
    
    // If the target time has already passed today, schedule for tomorrow
    if (currentHour > targetHour || (currentHour === targetHour && currentMinute > 5)) {
      nextNotification.setDate(nextNotification.getDate() + 1);
    }
    
    const timeUntilNext = nextNotification.getTime() - now.getTime();
    
    console.log(`[NotificationScheduler] Scheduling notification for ${targetHour}:00 in ${Math.round(timeUntilNext / 1000 / 60)} minutes`);
    
    const scheduleId = setTimeout(async () => {
      await this.triggerScheduledNotification(driverId, targetHour);
      
      // Reschedule for next day
      const newScheduleId = this.scheduleNotificationAtTime(driverId, targetHour);
      
      // Update the schedule ID in the active schedules
      const currentSchedules = this.activeSchedules.get(driverId) || [];
      const updatedSchedules = currentSchedules.map(id => 
        id === scheduleId ? newScheduleId : id
      );
      this.activeSchedules.set(driverId, updatedSchedules);
      
    }, timeUntilNext);
    
    return scheduleId;
  }

  /**
   * Trigger a scheduled notification
   */
  static async triggerScheduledNotification(driverId, hour) {
    try {
      console.log(`[NotificationScheduler] Triggering scheduled notification for driver ${driverId} at ${hour}:00`);
      
      // Check if notifications are dismissed for today
      if (BreakevenNotificationManager.areNotificationsDismissedForToday(driverId)) {
        console.log(`[NotificationScheduler] Notifications dismissed for today, skipping`);
        return;
      }
      
      // Get current breakeven data from storage
      const breakevenData = await this.getCurrentBreakevenData(driverId);
      
      if (!breakevenData) {
        console.log(`[NotificationScheduler] No breakeven data available for driver ${driverId}`);
        return;
      }
      
      // Check if there's meaningful data to report
      if (breakevenData.expenses <= 0 && breakevenData.revenue_period <= 0) {
        console.log(`[NotificationScheduler] No meaningful data to report for driver ${driverId}`);
        return;
      }
      
      // Trigger the notification
      await BreakevenNotificationManager.sendDailyBreakevenSummary(driverId, breakevenData);
      
      // Mark notification as sent
      BreakevenNotificationManager.markNotificationSent(driverId);
      
    } catch (error) {
      console.error(`[NotificationScheduler] Error triggering scheduled notification:`, error);
    }
  }

  /**
   * Get current breakeven data for a driver
   */
  static async getCurrentBreakevenData(driverId) {
    try {
      // Try to get data from AsyncStorage first (most recent)
      const storedData = await AsyncStorage.getItem(`breakeven_last_${driverId}`);
      
      if (storedData) {
        const data = JSON.parse(storedData);
        
        // Check if data is from today (not stale)
        const dataDate = new Date(data.timestamp);
        const today = new Date();
        const isToday = dataDate.toDateString() === today.toDateString();
        
        if (isToday) {
          return {
            expenses: data.expenses || 0,
            revenue_period: data.revenue || 0,
            total_bookings: data.total_bookings || 0,
            bookings_needed: data.bookings_needed || 0
          };
        }
      }
      
      // If no recent data, return null (will skip notification)
      return null;
      
    } catch (error) {
      console.error(`[NotificationScheduler] Error getting breakeven data:`, error);
      return null;
    }
  }

  /**
   * Check if it's currently a scheduled notification time
   */
  static isScheduledTime() {
    const currentHour = new Date().getHours();
    return this.scheduledTimes.includes(currentHour);
  }

  /**
   * Get time until next scheduled notification
   */
  static getTimeUntilNextNotification() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Find next scheduled time
    let nextHour = null;
    
    for (const hour of this.scheduledTimes) {
      if (hour > currentHour || (hour === currentHour && currentMinute < 5)) {
        nextHour = hour;
        break;
      }
    }
    
    // If no time found today, use first time tomorrow
    if (nextHour === null) {
      nextHour = this.scheduledTimes[0] + 24; // Add 24 hours for tomorrow
    }
    
    const nextNotification = new Date();
    nextNotification.setHours(nextHour % 24, 0, 0, 0);
    
    if (nextHour >= 24) {
      nextNotification.setDate(nextNotification.getDate() + 1);
    }
    
    return nextNotification.getTime() - now.getTime();
  }

  /**
   * Clean up all schedules (call on app close/background)
   */
  static cleanup() {
    console.log('[NotificationScheduler] Cleaning up all scheduled notifications');
    
    for (const [driverId, scheduleIds] of this.activeSchedules) {
      scheduleIds.forEach(id => {
        if (id) clearTimeout(id);
      });
    }
    
    this.activeSchedules.clear();
    this.isInitialized = false;
  }
}

export default NotificationScheduler;
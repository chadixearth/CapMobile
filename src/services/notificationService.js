import { supabase } from './supabase';

class NotificationService {
  // Send notification to backend
  static async sendNotification(userIds, title, message, type = 'info', role = 'tourist') {
    try {
      const response = await fetch('http://192.168.1.5:8000/api/notifications/', {
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
      const response = await fetch(`http://192.168.1.5:8000/api/notifications/?user_id=${userId}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      const response = await fetch('http://192.168.1.5:8000/api/notifications/mark-read/', {
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

  // Subscribe to real-time notifications
  static subscribeToNotifications(userId, callback) {
    return supabase
      .channel('notification_recipients')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_recipients',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  }

  // Notify all drivers when tourist books
  static async notifyDriversOfNewBooking(bookingData) {
    try {
      // Get all active drivers
      const { data: drivers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['driver', 'driver-owner'])
        .eq('status', 'active');

      // Send notification to all drivers
      const driverIds = drivers.map(d => d.id);
      await this.sendNotification(
        driverIds,
        'New Booking Available',
        `New tour booking from ${bookingData.tourist_name || 'Tourist'}. Package: ${bookingData.package_name}`,
        'booking',
        'driver'
      );
      return { success: true };
    } catch (error) {
      console.error('Error notifying drivers:', error);
      return { success: false, error: error.message };
    }
  }

  // Notify tourist when driver accepts booking
  static async notifyTouristOfAcceptedBooking(touristId, driverName, bookingData) {
    return this.sendNotification(
      [touristId],
      'Booking Accepted!',
      `Your booking has been accepted by ${driverName}. Get ready for your tour!`,
      'booking_accepted',
      'tourist'
    );
  }
}

export default NotificationService;
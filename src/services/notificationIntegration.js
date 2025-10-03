// Comprehensive notification integration service
// Ensures all booking events trigger appropriate notifications

import NotificationService from './notificationService';

class NotificationIntegration {
  
  // Tourist creates a new booking
  static async onBookingCreated(bookingData) {
    try {
      console.log('[NotificationIntegration] Booking created:', bookingData.id);
      
      // Notify drivers of new booking (already implemented in backend)
      const driverNotification = await NotificationService.notifyDriversOfNewBooking(bookingData);
      
      // Notify admin of new booking for monitoring
      try {
        await NotificationService.sendNotification(
          ['admin'], // Will be filtered to actual admin IDs by backend
          'New Booking Created 📋',
          `${bookingData.customer_name || 'Tourist'} created a booking for ${bookingData.package_name || 'tour package'}. Amount: ₱${bookingData.total_amount || 0}`,
          'booking',
          'admin'
        );
      } catch (adminError) {
        console.warn('[NotificationIntegration] Admin notification failed:', adminError);
      }
      
      return driverNotification;
    } catch (error) {
      console.error('[NotificationIntegration] Error in booking created:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Driver accepts a booking
  static async onBookingAccepted(bookingData, driverName) {
    try {
      console.log('[NotificationIntegration] Booking accepted:', bookingData.id);
      
      // Notify tourist (already implemented in backend)
      const touristNotification = await NotificationService.notifyTouristOfAcceptedBooking(
        bookingData.customer_id,
        driverName,
        bookingData
      );
      
      // Notify owner if driver-owner model
      if (bookingData.owner_id && bookingData.owner_id !== bookingData.driver_id) {
        try {
          await NotificationService.sendNotification(
            [bookingData.owner_id],
            'Booking Accepted by Your Driver 🚗',
            `${driverName} accepted a booking for ${bookingData.package_name || 'tour'}. Customer: ${bookingData.customer_name || 'Tourist'}. Date: ${bookingData.booking_date}`,
            'booking',
            'owner'
          );
        } catch (ownerError) {
          console.warn('[NotificationIntegration] Owner notification failed:', ownerError);
        }
      }
      
      return touristNotification;
    } catch (error) {
      console.error('[NotificationIntegration] Error in booking accepted:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Payment is completed for a booking
  static async onPaymentCompleted(bookingData, paymentData) {
    try {
      console.log('[NotificationIntegration] Payment completed:', bookingData.id);
      
      // Notify tourist of successful payment
      await NotificationService.sendNotification(
        [bookingData.customer_id],
        'Payment Confirmed! ✅💳',
        `Your payment of ₱${paymentData.amount} for ${bookingData.package_name || 'tour'} has been confirmed. Your booking is now secured!`,
        'payment',
        'tourist'
      );
      
      // Notify driver that booking is now paid and ready
      if (bookingData.driver_id) {
        await NotificationService.sendNotification(
          [bookingData.driver_id],
          'Booking Payment Received! 💰',
          `Payment confirmed for your accepted booking. Customer: ${bookingData.customer_name || 'Tourist'}. Tour: ${bookingData.package_name || 'tour'}. Ready to start!`,
          'payment',
          'driver'
        );
      }
      
      // Notify owner of payment received
      if (bookingData.owner_id) {
        await NotificationService.notifyOwnerOfPaymentReceived(
          bookingData.owner_id,
          bookingData,
          paymentData.amount
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error('[NotificationIntegration] Error in payment completed:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Booking is started by driver
  static async onBookingStarted(bookingData) {
    try {
      console.log('[NotificationIntegration] Booking started:', bookingData.id);
      
      // Notify tourist that tour has started
      await NotificationService.sendNotification(
        [bookingData.customer_id],
        'Your Tour Has Started! 🚀',
        `${bookingData.driver_name || 'Your driver'} has started your ${bookingData.package_name || 'tour'}. Enjoy your experience!`,
        'booking',
        'tourist'
      );
      
      // Notify owner that tour is in progress
      if (bookingData.owner_id && bookingData.owner_id !== bookingData.driver_id) {
        await NotificationService.sendNotification(
          [bookingData.owner_id],
          'Tour Started 🎯',
          `${bookingData.driver_name || 'Driver'} started the tour for ${bookingData.customer_name || 'customer'}. Package: ${bookingData.package_name || 'tour'}`,
          'booking',
          'owner'
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error('[NotificationIntegration] Error in booking started:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Booking is completed by driver
  static async onBookingCompleted(bookingData, earningsData) {
    try {
      console.log('[NotificationIntegration] Booking completed:', bookingData.id);
      
      // Notify tourist of completion
      await NotificationService.sendNotification(
        [bookingData.customer_id],
        'Tour Completed! 🎉',
        `Your ${bookingData.package_name || 'tour'} with ${bookingData.driver_name || 'driver'} has been completed. Thank you for choosing our service!`,
        'booking',
        'tourist'
      );
      
      // Notify driver of earnings
      if (bookingData.driver_id && earningsData) {
        await NotificationService.sendNotification(
          [bookingData.driver_id],
          'Earnings Added! 💰',
          `Tour completed! Your earnings of ₱${earningsData.driver_share || 0} have been added to your pending payout. Great job!`,
          'payment',
          'driver'
        );
      }
      
      // Notify owner of completion and earnings
      if (bookingData.owner_id && bookingData.owner_id !== bookingData.driver_id) {
        await NotificationService.sendNotification(
          [bookingData.owner_id],
          'Tour Completed Successfully! ✅',
          `${bookingData.driver_name || 'Driver'} completed the tour for ${bookingData.customer_name || 'customer'}. Revenue: ₱${bookingData.total_amount || 0}`,
          'booking',
          'owner'
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error('[NotificationIntegration] Error in booking completed:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Booking is cancelled
  static async onBookingCancelled(bookingData, cancelledBy, reason) {
    try {
      console.log('[NotificationIntegration] Booking cancelled:', bookingData.id, 'by:', cancelledBy);
      
      if (cancelledBy === 'customer') {
        // Notify driver of customer cancellation
        if (bookingData.driver_id) {
          await NotificationService.sendNotification(
            [bookingData.driver_id],
            'Booking Cancelled by Customer ❌',
            `${bookingData.customer_name || 'Customer'} cancelled their ${bookingData.package_name || 'tour'} booking. Reason: ${reason || 'Not specified'}`,
            'booking',
            'driver'
          );
        }
        
        // Notify owner of cancellation
        if (bookingData.owner_id) {
          await NotificationService.sendNotification(
            [bookingData.owner_id],
            'Customer Cancellation 📋',
            `${bookingData.customer_name || 'Customer'} cancelled their booking for ${bookingData.package_name || 'tour'}. Refund may be processed.`,
            'booking',
            'owner'
          );
        }
      } else if (cancelledBy === 'driver') {
        // Tourist and admin notifications are handled in backend
        // Notify owner of driver cancellation
        if (bookingData.owner_id && bookingData.owner_id !== bookingData.driver_id) {
          await NotificationService.sendNotification(
            [bookingData.owner_id],
            'Driver Cancelled Booking ⚠️',
            `${bookingData.driver_name || 'Your driver'} cancelled a booking. Customer: ${bookingData.customer_name || 'Tourist'}. Reason: ${reason || 'Not specified'}. Booking reassigned.`,
            'booking',
            'owner'
          );
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('[NotificationIntegration] Error in booking cancelled:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Special event booking created
  static async onSpecialEventCreated(eventData) {
    try {
      console.log('[NotificationIntegration] Special event created:', eventData.id);
      
      // Notify all owners (already implemented)
      return await NotificationService.notifyOwnersOfNewSpecialEvent(eventData);
    } catch (error) {
      console.error('[NotificationIntegration] Error in special event created:', error);
      return { success: false, error: error.message };
    }
  }
  
  // System maintenance notification
  static async onSystemMaintenance(maintenanceData) {
    try {
      console.log('[NotificationIntegration] System maintenance notification');
      
      // Get all active users
      const { data: users } = await supabase
        .from('users')
        .select('id, role')
        .eq('status', 'active');
      
      if (users && users.length > 0) {
        const userIds = users.map(u => u.id);
        
        await NotificationService.sendNotification(
          userIds,
          'System Maintenance Notice 🔧',
          `Scheduled maintenance: ${maintenanceData.description}. Time: ${maintenanceData.scheduled_time}. Expected duration: ${maintenanceData.duration}. Service may be temporarily unavailable.`,
          'booking',
          'all'
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error('[NotificationIntegration] Error in system maintenance:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Driver performance issue
  static async onDriverPerformanceIssue(driverData, ownerData, performanceIssue) {
    try {
      console.log('[NotificationIntegration] Driver performance issue:', driverData.id);
      
      if (ownerData && ownerData.id) {
        return await NotificationService.notifyOwnerOfDriverPerformance(
          ownerData.id,
          driverData,
          performanceIssue
        );
      }
      
      return { success: true, message: 'No owner to notify' };
    } catch (error) {
      console.error('[NotificationIntegration] Error in driver performance issue:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Carriage issue reported
  static async onCarriageIssue(carriageData, ownerData, issueType, description) {
    try {
      console.log('[NotificationIntegration] Carriage issue:', carriageData.id);
      
      if (ownerData && ownerData.id) {
        return await NotificationService.notifyOwnerOfCarriageIssue(
          ownerData.id,
          carriageData,
          issueType,
          description
        );
      }
      
      return { success: true, message: 'No owner to notify' };
    } catch (error) {
      console.error('[NotificationIntegration] Error in carriage issue:', error);
      return { success: false, error: error.message };
    }
  }
}

export default NotificationIntegration;
import { checkAndCancelUnpaidBookings, getBookingsNearPaymentDeadline, sendPaymentReminder } from './tourpackage/paymentTimeoutService';

class PaymentTimeoutScheduler {
  constructor() {
    this.checkInterval = null;
    this.reminderInterval = null;
    this.isRunning = false;
    this.checkIntervalMs = 5 * 60 * 1000; // Check every 5 minutes
    this.reminderIntervalMs = 10 * 60 * 1000; // Send reminders every 10 minutes
  }

  /**
   * Start the payment timeout scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('[PaymentTimeoutScheduler] Already running');
      return;
    }

    console.log('[PaymentTimeoutScheduler] Starting payment timeout scheduler...');
    this.isRunning = true;

    // Check for unpaid bookings that need cancellation
    this.checkInterval = setInterval(async () => {
      try {
        await checkAndCancelUnpaidBookings();
      } catch (error) {
        console.error('[PaymentTimeoutScheduler] Error in check interval:', error);
      }
    }, this.checkIntervalMs);

    // Send payment reminders for bookings near deadline
    this.reminderInterval = setInterval(async () => {
      try {
        await this.sendRemindersForNearDeadlineBookings();
      } catch (error) {
        console.error('[PaymentTimeoutScheduler] Error in reminder interval:', error);
      }
    }, this.reminderIntervalMs);

    console.log('[PaymentTimeoutScheduler] Scheduler started successfully');
  }

  /**
   * Stop the payment timeout scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('[PaymentTimeoutScheduler] Not running');
      return;
    }

    console.log('[PaymentTimeoutScheduler] Stopping payment timeout scheduler...');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }

    this.isRunning = false;
    console.log('[PaymentTimeoutScheduler] Scheduler stopped');
  }

  /**
   * Send payment reminders for bookings near deadline
   */
  async sendRemindersForNearDeadlineBookings() {
    try {
      const result = await getBookingsNearPaymentDeadline();
      
      if (result.success && result.data?.bookings) {
        const bookings = result.data.bookings;
        
        for (const booking of bookings) {
          if (booking.customer_id && booking.payment_deadline) {
            const deadline = new Date(booking.payment_deadline);
            await sendPaymentReminder(booking.customer_id, booking, deadline);
          }
        }
        
        if (bookings.length > 0) {
          console.log(`[PaymentTimeoutScheduler] Sent reminders for ${bookings.length} bookings`);
        }
      }
    } catch (error) {
      console.error('[PaymentTimeoutScheduler] Error sending reminders:', error);
    }
  }

  /**
   * Manually trigger payment timeout check
   */
  async triggerCheck() {
    console.log('[PaymentTimeoutScheduler] Manually triggering payment timeout check...');
    try {
      const result = await checkAndCancelUnpaidBookings();
      console.log('[PaymentTimeoutScheduler] Manual check result:', result);
      return result;
    } catch (error) {
      console.error('[PaymentTimeoutScheduler] Error in manual check:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if scheduler is running
   */
  isActive() {
    return this.isRunning;
  }

  /**
   * Update check interval (in milliseconds)
   */
  setCheckInterval(intervalMs) {
    this.checkIntervalMs = intervalMs;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

const paymentTimeoutScheduler = new PaymentTimeoutScheduler();
export default paymentTimeoutScheduler;

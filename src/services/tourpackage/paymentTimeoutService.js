import apiClient from '../apiClient';
import NotificationService from '../notificationService';
import { invalidateData } from '../dataInvalidationService';

const API_BASE_URL = '/tour-booking';
const PAYMENT_TIMEOUT_HOURS = 24;

/**
 * Check and cancel unpaid bookings that exceeded 24-hour payment deadline
 * @returns {Promise<Object>} Cancellation result with affected bookings
 */
export async function checkAndCancelUnpaidBookings() {
  try {
    console.log('[PaymentTimeout] Checking for unpaid bookings exceeding 24-hour deadline...');
    
    const endpoint = `${API_BASE_URL}/cancel-unpaid-bookings/`;
    const result = await apiClient.post(endpoint);
    
    if (result.data?.success) {
      const cancelledBookings = result.data.data?.cancelled_bookings || [];
      
      console.log(`[PaymentTimeout] Cancelled ${cancelledBookings.length} unpaid bookings`);
      
      // Notify tourists about cancellations
      if (cancelledBookings.length > 0) {
        await notifyTouristsOfCancellations(cancelledBookings);
      }
      
      invalidateData.bookings();
    }
    
    return result.data;
  } catch (error) {
    console.error('[PaymentTimeout] Error checking unpaid bookings:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify tourists about automatic cancellations due to payment timeout
 * @param {Array} cancelledBookings - Array of cancelled booking objects
 */
async function notifyTouristsOfCancellations(cancelledBookings) {
  try {
    const touristIds = cancelledBookings.map(b => b.customer_id).filter(Boolean);
    
    if (touristIds.length === 0) return;
    
    const message = 'Payment Timeout - Booking Cancelled ⏰❌';
    const description = 'Your tour package booking was automatically cancelled because payment was not completed within 24 hours of driver acceptance. Please book again if interested.';
    
    const notifResult = await NotificationService.sendNotification(
      touristIds,
      message,
      description,
      'booking_cancelled_payment_timeout',
      'tourist'
    );
    
    console.log('[PaymentTimeout] Tourist notifications sent:', notifResult);
  } catch (error) {
    console.warn('[PaymentTimeout] Failed to notify tourists (non-critical):', error);
  }
}

/**
 * Get bookings approaching payment deadline (within 1 hour)
 * @returns {Promise<Object>} Bookings near deadline
 */
export async function getBookingsNearPaymentDeadline() {
  try {
    console.log('[PaymentTimeout] Fetching bookings near payment deadline...');
    
    const endpoint = `${API_BASE_URL}/bookings-near-deadline/`;
    const result = await apiClient.get(endpoint);
    
    console.log('[PaymentTimeout] Bookings near deadline:', result.data);
    return result.data;
  } catch (error) {
    console.error('[PaymentTimeout] Error fetching bookings near deadline:', error.message);
    return { success: false, error: error.message, data: { bookings: [] } };
  }
}

/**
 * Send payment reminder notification to tourist
 * @param {string} customerId - Tourist ID
 * @param {Object} bookingData - Booking information
 * @param {Date} deadline - Payment deadline
 */
export async function sendPaymentReminder(customerId, bookingData, deadline) {
  try {
    const deadlineStr = deadline.toLocaleString();
    
    const notifResult = await NotificationService.sendNotification(
      [customerId],
      'Payment Reminder - Complete Your Booking 💳',
      `Please complete payment by ${deadlineStr} to confirm your tour. Your booking will be automatically cancelled if payment is not received.`,
      'payment_reminder',
      'tourist'
    );
    
    console.log('[PaymentTimeout] Payment reminder sent:', notifResult);
    return notifResult;
  } catch (error) {
    console.warn('[PaymentTimeout] Failed to send payment reminder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get payment status for a booking
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Object>} Payment status
 */
export async function getBookingPaymentStatus(bookingId) {
  try {
    const endpoint = `${API_BASE_URL}/${bookingId}/payment-status/`;
    const result = await apiClient.get(endpoint);
    
    return result.data;
  } catch (error) {
    console.error('[PaymentTimeout] Error fetching payment status:', error.message);
    return { success: false, error: error.message };
  }
}

export default {
  checkAndCancelUnpaidBookings,
  getBookingsNearPaymentDeadline,
  sendPaymentReminder,
  getBookingPaymentStatus,
  PAYMENT_TIMEOUT_HOURS,
};

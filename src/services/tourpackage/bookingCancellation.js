import { supabase } from '../supabase';
import { apiBaseUrl } from '../networkConfig';

const API_BASE_URL = apiBaseUrl();

/**
 * Check cancellation policy for a booking
 */
export const getCancellationPolicy = async (bookingId, customerId) => {
  try {
    const url = `${API_BASE_URL}/tour-booking/cancellation-policy/${bookingId}/`;
    const params = customerId ? `?customer_id=${customerId}` : '';
    
    const response = await fetch(`${url}${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let result;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = { error: `Server returned non-JSON response: ${response.status}` };
    }
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      data: result.data || result,
    };
  } catch (error) {
    console.error('Error checking cancellation policy:', error);
    return {
      success: false,
      error: error.message || 'Failed to check cancellation policy',
    };
  }
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (bookingId, customerId, reason = '') => {
  try {
    const url = `${API_BASE_URL}/tour-booking/customer-cancel/${bookingId}/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        reason: reason,
      }),
    });

    let result;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = { error: `Server returned non-JSON response: ${response.status}` };
    }
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      data: result.data || result,
      cancellation_policy: result.cancellation_policy,
      refund_info: result.refund_info,
      message: result.message,
    };
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel booking',
    };
  }
};

/**
 * Calculate cancellation fee based on booking date
 */
export const calculateCancellationFee = (bookingDate, totalAmount) => {
  const booking = new Date(bookingDate);
  const now = new Date();
  const diffTime = booking.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let feePercentage = 0;
  let policyMessage = '';

  if (diffDays >= 3) {
    feePercentage = 0;
    policyMessage = 'Free cancellation (3+ days notice)';
  } else if (diffDays >= 1) {
    feePercentage = 0.25;
    policyMessage = '25% cancellation fee applies (less than 3 days notice)';
  } else {
    feePercentage = 0.50;
    policyMessage = '50% cancellation fee applies (same day cancellation)';
  }

  const cancellationFee = totalAmount * feePercentage;
  const refundAmount = totalAmount - cancellationFee;

  return {
    can_cancel: true,
    total_amount: totalAmount,
    cancellation_fee: cancellationFee,
    refund_amount: refundAmount,
    policy_message: policyMessage,
    days_until_booking: diffDays,
  };
};
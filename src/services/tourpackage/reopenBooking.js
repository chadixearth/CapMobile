import { apiBaseUrl } from '../networkConfig';

const API_BASE_URL = `${apiBaseUrl()}/tour-booking/`;

/**
 * Reopen a cancelled booking to make it available for other drivers
 */
export const reopenBooking = async (bookingId, driverId) => {
  try {
    const url = `${API_BASE_URL}reopen/${bookingId}/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        driver_id: driverId,
        status: 'waiting_for_driver'
      }),
    });

    let result;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = { success: true };
    }
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      data: result.data || result,
    };
  } catch (error) {
    console.error('Error reopening booking:', error);
    return {
      success: false,
      error: error.message || 'Failed to reopen booking',
    };
  }
};
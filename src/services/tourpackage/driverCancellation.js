import { apiBaseUrl } from '../networkConfig';

const API_BASE_URL = apiBaseUrl();

/**
 * Driver cancels a booking with reason
 */
export const driverCancelBooking = async (bookingId, driverId, reason) => {
  try {
    const url = `${API_BASE_URL}/tour-booking/driver-cancel/${bookingId}/`;
    
    console.log('[API] Driver cancellation request:', {
      url,
      bookingId,
      driverId,
      reason
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driver_id: driverId,
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
    
    console.log('[API] Response status:', response.status);
    console.log('[API] Response result:', result);
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      data: result.data || result,
      message: result.message || 'Booking cancelled and reassigned successfully',
      reassignment_status: result.reassignment_status,
      driver_suspended: result.driver_suspended,
      suspension: result.suspension,
    };
  } catch (error) {
    console.error('[API] Error cancelling booking:', error);
    return {
      success: false,
      error: error.message || 'Failed to cancel booking',
    };
  }
};

/**
 * Get cancellation reasons for drivers
 */
export const getCancellationReasons = () => {
  return [
    'Vehicle breakdown',
    'Personal emergency', 
    'Traffic/road conditions',
    'Customer no-show',
    'Safety concerns',
    'Double booking',
    'Weather conditions',
    'Health issues',
    'Family emergency',
    'Customer behavior issues',
    'Route/location problems',
    'Other'
  ];
};

/**
 * Create a report for driver cancellation
 */
export const createCancellationReport = async (reportData) => {
  try {
    const url = `${API_BASE_URL}/reports/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData),
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
      message: result.message || 'Report created successfully',
    };
  } catch (error) {
    console.error('Error creating report:', error);
    return {
      success: false,
      error: error.message || 'Failed to create report',
    };
  }
};
/**
 * Trip Start Constraints Service
 * Validates if a driver can start a tour package trip based on:
 * - Payment status (must be paid)
 * - Scheduled date and time (can only start at or after scheduled time)
 */

/**
 * Check if driver can start the trip
 * @param {Object} booking - The booking object
 * @param {string} booking.status - Booking status
 * @param {string} booking.booking_date - Scheduled date (YYYY-MM-DD)
 * @param {string} booking.booking_time - Scheduled time (HH:MM or HH:MM:SS)
 * @returns {Object} { canStart: boolean, reason: string, message: string }
 */
export function validateTripStart(booking) {
  if (!booking) {
    return {
      canStart: false,
      reason: 'INVALID_BOOKING',
      message: 'Booking information is missing'
    };
  }

  // Check payment status
  if (booking.status !== 'paid') {
    return {
      canStart: false,
      reason: 'NOT_PAID',
      message: 'Trip cannot start. Customer has not paid yet.'
    };
  }

  // Check scheduled time
  const { canStart, timeUntil, isPast } = checkScheduledTime(
    booking.booking_date,
    booking.booking_time
  );

  if (!canStart) {
    if (isPast) {
      return {
        canStart: false,
        reason: 'TIME_PASSED',
        message: `Scheduled time has passed. Please contact customer.`
      };
    }

    return {
      canStart: false,
      reason: 'TOO_EARLY',
      message: `Trip starts at ${booking.booking_time}. You can start in ${timeUntil}.`
    };
  }

  return {
    canStart: true,
    reason: null,
    message: 'Trip can be started'
  };
}

/**
 * Check if current time is at or after scheduled time
 * @param {string} bookingDate - Date in YYYY-MM-DD format
 * @param {string} bookingTime - Time in HH:MM or HH:MM:SS format
 * @returns {Object} { canStart: boolean, timeUntil: string, isPast: boolean }
 */
function checkScheduledTime(bookingDate, bookingTime) {
  try {
    const now = new Date();
    
    // Parse booking date and time
    const [year, month, day] = bookingDate.split('-').map(Number);
    const timeParts = bookingTime.split(':').map(Number);
    const [hours, minutes] = timeParts;
    
    const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0);
    
    // Check if scheduled time is in the past (more than 24 hours ago)
    const hoursDiff = (now - scheduledDateTime) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      return {
        canStart: false,
        timeUntil: null,
        isPast: true
      };
    }
    
    // Check if current time is at or after scheduled time
    if (now >= scheduledDateTime) {
      return {
        canStart: true,
        timeUntil: null,
        isPast: false
      };
    }
    
    // Calculate time until scheduled time
    const diffMs = scheduledDateTime - now;
    const timeUntil = formatTimeDifference(diffMs);
    
    return {
      canStart: false,
      timeUntil,
      isPast: false
    };
  } catch (error) {
    console.error('Error checking scheduled time:', error);
    // On error, allow start to prevent blocking
    return {
      canStart: true,
      timeUntil: null,
      isPast: false
    };
  }
}

/**
 * Format time difference in human-readable format
 * @param {number} diffMs - Time difference in milliseconds
 * @returns {string} Formatted time (e.g., "2h 30m", "45m", "5m")
 */
function formatTimeDifference(diffMs) {
  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

/**
 * Get time until trip can start
 * @param {string} bookingDate - Date in YYYY-MM-DD format
 * @param {string} bookingTime - Time in HH:MM or HH:MM:SS format
 * @returns {string|null} Time until start or null if can start now
 */
export function getTimeUntilStart(bookingDate, bookingTime) {
  const result = checkScheduledTime(bookingDate, bookingTime);
  return result.canStart ? null : result.timeUntil;
}

/**
 * Check if booking is ready to start (paid + time reached)
 * @param {Object} booking - The booking object
 * @returns {boolean} True if ready to start
 */
export function isReadyToStart(booking) {
  const result = validateTripStart(booking);
  return result.canStart;
}

export default {
  validateTripStart,
  getTimeUntilStart,
  isReadyToStart
};

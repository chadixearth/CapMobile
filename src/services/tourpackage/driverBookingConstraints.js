import apiClient from '../apiClient';

/**
 * Check if driver can accept a new booking based on constraints:
 * - Only 1 booking per day
 * - Exception: Same tour package allowed if no time conflict
 * - Time conflict check for same package
 */
export async function validateDriverBookingConstraints(driverId, newBooking) {
  try {
    const { booking_date, booking_time, package_id, package_name } = newBooking;
    
    // Get all driver's bookings for the same date
    const endpoint = `/tour-booking/driver/${driverId}/?booking_date=${booking_date}`;
    const result = await apiClient.get(endpoint);
    
    if (!result.data?.success) {
      return { canAccept: true, reason: null };
    }
    
    const existingBookings = result.data.data?.bookings || [];
    const activeBookings = existingBookings.filter(b => 
      ['pending', 'driver_assigned', 'paid', 'in_progress'].includes(b.status)
    );
    
    if (activeBookings.length === 0) {
      return { canAccept: true, reason: null };
    }
    
    // Check if any booking is for a different package
    const differentPackageBooking = activeBookings.find(b => 
      b.package_id !== package_id
    );
    
    if (differentPackageBooking) {
      return {
        canAccept: false,
        reason: 'DIFFERENT_PACKAGE_SAME_DAY',
        message: `You already have a booking for "${differentPackageBooking.package_name}" on ${booking_date}. You can only accept one booking per day unless it's the same tour package.`,
        existingBooking: differentPackageBooking
      };
    }
    
    // Same package - check for time conflicts
    const samePackageBookings = activeBookings.filter(b => 
      b.package_id === package_id
    );
    
    for (const existing of samePackageBookings) {
      const conflict = checkTimeConflict(
        booking_time, 
        newBooking.duration || 60,
        existing.booking_time,
        existing.duration || 60
      );
      
      if (conflict) {
        return {
          canAccept: false,
          reason: 'TIME_CONFLICT_SAME_PACKAGE',
          message: `Time conflict detected! You already have a booking for "${package_name}" at ${existing.booking_time} on ${booking_date}. The new booking at ${booking_time} would overlap.`,
          existingBooking: existing,
          conflictDetails: conflict
        };
      }
    }
    
    return { 
      canAccept: true, 
      reason: null,
      message: `Same package booking allowed - no time conflicts detected.`
    };
    
  } catch (error) {
    console.error('[validateDriverBookingConstraints] Error:', error);
    // On error, allow booking to prevent blocking
    return { canAccept: true, reason: 'VALIDATION_ERROR', error: error.message };
  }
}

/**
 * Check if two time slots conflict
 * @param {string} time1 - Format: "HH:MM" or "HH:MM:SS"
 * @param {number} duration1 - Duration in minutes
 * @param {string} time2 - Format: "HH:MM" or "HH:MM:SS"
 * @param {number} duration2 - Duration in minutes
 * @returns {Object|null} Conflict details or null if no conflict
 */
function checkTimeConflict(time1, duration1, time2, duration2) {
  try {
    const start1 = parseTime(time1);
    const end1 = start1 + duration1;
    
    const start2 = parseTime(time2);
    const end2 = start2 + duration2;
    
    // Check if time ranges overlap
    const hasConflict = (start1 < end2 && end1 > start2);
    
    if (hasConflict) {
      return {
        hasConflict: true,
        booking1: { start: formatMinutes(start1), end: formatMinutes(end1) },
        booking2: { start: formatMinutes(start2), end: formatMinutes(end2) },
        overlapMinutes: Math.min(end1, end2) - Math.max(start1, start2)
      };
    }
    
    return null;
  } catch (error) {
    console.error('[checkTimeConflict] Error:', error);
    return null;
  }
}

/**
 * Parse time string to minutes since midnight
 * @param {string} timeStr - Format: "HH:MM" or "HH:MM:SS"
 * @returns {number} Minutes since midnight
 */
function parseTime(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to time string
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Format: "HH:MM"
 */
function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Get driver's bookings summary for a date
 */
export async function getDriverBookingsSummary(driverId, date) {
  try {
    const endpoint = `/tour-booking/driver/${driverId}/?booking_date=${date}`;
    const result = await apiClient.get(endpoint);
    
    if (!result.data?.success) {
      return { bookings: [], count: 0 };
    }
    
    const bookings = result.data.data?.bookings || [];
    const activeBookings = bookings.filter(b => 
      ['pending', 'driver_assigned', 'paid', 'in_progress'].includes(b.status)
    );
    
    return {
      bookings: activeBookings,
      count: activeBookings.length,
      packages: [...new Set(activeBookings.map(b => b.package_name))]
    };
  } catch (error) {
    console.error('[getDriverBookingsSummary] Error:', error);
    return { bookings: [], count: 0, packages: [] };
  }
}

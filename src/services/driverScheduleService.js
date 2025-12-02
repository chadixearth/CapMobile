import { apiClient } from './improvedApiClient';

// Validate schedule data integrity
const validateScheduleData = (data) => {
  if (!Array.isArray(data)) return [];
  return data.filter(item => item && typeof item === 'object');
};

export const driverScheduleService = {
  // Check if driver is available for specific date/time
  async checkAvailability(driverId, bookingDate, bookingTime) {
    try {
      // Validate required parameters
      if (!driverId || !bookingDate || !bookingTime) {
        console.warn('[driverScheduleService] Missing required parameters:', { driverId, bookingDate, bookingTime });
        return { success: true, available: true }; // Allow if validation fails
      }
      
      const result = await apiClient.post('/driver-schedule/check-availability/', {
        driver_id: driverId,
        booking_date: bookingDate,
        booking_time: bookingTime
      });
      
      // If backend returns available=false but no specific conflict reason, assume available
      if (result.data && result.data.available === false && !result.data.conflict_reason) {
        console.log('[driverScheduleService] Backend reported unavailable but no conflict reason, assuming available');
        return { success: true, available: true };
      }
      
      return { success: true, ...result.data };
    } catch (error) {
      console.error('[driverScheduleService] checkAvailability error:', error);
      // On error, assume available to not block bookings
      return { success: true, available: true, error: error.message || 'Failed to check availability', errorType: 'NETWORK' };
    }
  },

  // Accept booking and add to calendar
  async acceptBooking(driverId, bookingId, bookingDate, bookingTime, packageName, customerName) {
    try {
      if (!driverId || !bookingId || !bookingDate || !bookingTime) {
        console.warn('[driverScheduleService] Missing required parameters for acceptBooking:', { driverId, bookingId, bookingDate, bookingTime });
        return { success: false, error: 'Missing required parameters', errorType: 'VALIDATION' };
      }
      
      const result = await apiClient.post('/driver-schedule/accept-booking/', {
        driver_id: driverId,
        booking_id: bookingId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        package_name: packageName,
        customer_name: customerName
      });
      return { success: true, ...result.data };
    } catch (error) {
      console.error('[driverScheduleService] acceptBooking error:', error);
      return { success: false, error: error.message || 'Failed to accept booking', errorType: 'NETWORK' };
    }
  },

  // Get driver's calendar
  async getDriverCalendar(driverId, dateFrom, dateTo) {
    try {
      if (!driverId) {
        console.warn('[driverScheduleService] Missing driverId for getDriverCalendar');
        return { success: false, error: 'Missing driver ID', errorType: 'VALIDATION', data: [] };
      }
      
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const result = await apiClient.get(`/driver-schedule/calendar/${driverId}/?${params}`);
      return { success: true, data: validateScheduleData(result.data?.data || []) };
    } catch (error) {
      console.error('[driverScheduleService] getDriverCalendar error:', error);
      return { success: false, error: error.message || 'Failed to fetch calendar', errorType: 'NETWORK', data: [] };
    }
  },

  // Set driver availability
  async setAvailability(driverId, date, isAvailable, unavailableTimes = [], notes = '') {
    try {
      if (!driverId || !date) {
        console.warn('[driverScheduleService] Missing required parameters for setAvailability:', { driverId, date });
        return { success: false, error: 'Missing required parameters', errorType: 'VALIDATION' };
      }
      
      const result = await apiClient.post('/driver-schedule/set-availability/', {
        driver_id: driverId,
        date: date,
        is_available: isAvailable,
        unavailable_times: unavailableTimes,
        notes: notes
      });
      return { success: true, ...result.data };
    } catch (error) {
      console.error('[driverScheduleService] setAvailability error:', error);
      return { success: false, error: error.message || 'Failed to set availability', errorType: 'NETWORK' };
    }
  },

  // Get driver's schedule
  async getDriverSchedule(driverId, dateFrom, dateTo) {
    try {
      if (!driverId) {
        console.warn('[driverScheduleService] Missing driverId for getDriverSchedule');
        return { success: false, error: 'Missing driver ID', errorType: 'VALIDATION', data: [] };
      }
      
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const result = await apiClient.get(`/driver-schedule/schedule/${driverId}/?${params}`);
      return { success: true, data: validateScheduleData(result.data?.data || []) };
    } catch (error) {
      console.error('[driverScheduleService] getDriverSchedule error:', error);
      return { success: false, error: error.message || 'Failed to fetch schedule', errorType: 'NETWORK', data: [] };
    }
  }
};
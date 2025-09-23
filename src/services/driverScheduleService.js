import networkClient from './networkClient';

export const driverScheduleService = {
  // Check if driver is available for specific date/time
  async checkAvailability(driverId, bookingDate, bookingTime) {
    try {
      const result = await networkClient.post('/driver-schedule/check-availability/', {
        driver_id: driverId,
        booking_date: bookingDate,
        booking_time: bookingTime
      });
      return result.data;
    } catch (error) {
      return { available: true, conflict_reason: null }; // Default to available if check fails
    }
  },

  // Accept booking and add to calendar
  async acceptBooking(driverId, bookingId, bookingDate, bookingTime, packageName, customerName) {
    try {
      const result = await networkClient.post('/driver-schedule/accept-booking/', {
        driver_id: driverId,
        booking_id: bookingId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        package_name: packageName,
        customer_name: customerName
      });
      return result.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get driver's calendar
  async getDriverCalendar(driverId, dateFrom, dateTo) {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const result = await networkClient.get(`/driver-schedule/calendar/${driverId}/?${params}`);
      return result.data;
    } catch (error) {
      return { success: true, data: [] }; // Return empty calendar if fetch fails
    }
  },

  // Set driver availability
  async setAvailability(driverId, date, isAvailable, unavailableTimes = [], notes = '') {
    try {
      const result = await networkClient.post('/driver-schedule/schedule/set-availability/', {
        driver_id: driverId,
        date: date,
        is_available: isAvailable,
        unavailable_times: unavailableTimes,
        notes: notes
      });
      return result.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get driver's schedule
  async getDriverSchedule(driverId, dateFrom, dateTo) {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const result = await networkClient.get(`/driver-schedule/schedule/${driverId}/?${params}`);
      return result.data;
    } catch (error) {
      return { success: true, data: [] }; // Return empty schedule if fetch fails
    }
  }
};
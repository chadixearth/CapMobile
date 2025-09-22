import { apiBaseUrl } from './networkConfig';

const API_BASE_URL = apiBaseUrl();

export const driverScheduleService = {
  // Check if driver is available for specific date/time
  async checkAvailability(driverId, bookingDate, bookingTime) {
    try {
      const response = await fetch(`${API_BASE_URL}/driver-schedule/check-availability/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          booking_date: bookingDate,
          booking_time: bookingTime
        })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Accept booking and add to calendar
  async acceptBooking(driverId, bookingId, bookingDate, bookingTime, packageName, customerName) {
    try {
      const response = await fetch(`${API_BASE_URL}/driver-schedule/accept-booking/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          booking_id: bookingId,
          booking_date: bookingDate,
          booking_time: bookingTime,
          package_name: packageName,
          customer_name: customerName
        })
      });
      return await response.json();
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
      
      const response = await fetch(`${API_BASE_URL}/driver-schedule/calendar/${driverId}/?${params}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Set driver availability
  async setAvailability(driverId, date, isAvailable, unavailableTimes = [], notes = '') {
    try {
      const response = await fetch(`${API_BASE_URL}/driver-schedule/schedule/set-availability/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          date: date,
          is_available: isAvailable,
          unavailable_times: unavailableTimes,
          notes: notes
        })
      });
      return await response.json();
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
      
      const response = await fetch(`${API_BASE_URL}/driver-schedule/schedule/${driverId}/?${params}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
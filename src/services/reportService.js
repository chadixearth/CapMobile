import { getAccessToken } from './authService';
import { apiBaseUrl } from './networkConfig';

const API_BASE_URL = `${apiBaseUrl()}/reports/`;

export async function submitTripReport(bookingId, driverId, reportData) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${API_BASE_URL}trip-report/`;
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        booking_id: bookingId,
        driver_id: driverId,
        ...reportData
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Report failed: ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    console.error('Error submitting trip report:', error);
    throw error;
  }
}
// Earnings Service API// EarningsService.js
import { getAccessToken } from '../authService';
import { Platform, NativeModules } from 'react-native';
import { apiBaseUrl } from '../networkConfig';

function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

const EARNINGS_API_BASE_URL = `${apiBaseUrl()}/earnings/`;

/**
 * Get driver earnings summary for tour packages
 * @param {string} driverId - The driver's ID
 * @param {Object} filters - Optional filters (date_from, date_to, limit)
 * @returns {Promise<Object>} Driver earnings data
 */
export async function getDriverEarnings(driverId, filters = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('driver_id', driverId);
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = `${EARNINGS_API_BASE_URL}tour_package_earnings/?${queryParams.toString()}`;
    
    console.log('Fetching driver earnings from:', url);
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Earnings API Error Response:', errorText);
      
      // Return empty data instead of throwing for 500 errors
      if (response.status >= 500) {
        console.warn('Server error, returning empty earnings data');
        return {
          success: true,
          data: {
            earnings: [],
            statistics: {
              total_revenue: 0,
              total_driver_earnings: 0,
              total_admin_earnings: 0,
              admin_percentage: 20,
              driver_percentage: 80,
              count: 0
            }
          }
        };
      }
      
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Driver earnings response:', data);
    return data;
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('Driver earnings request aborted/timeout. Returning empty data.');
      return { 
        success: true, 
        data: { 
          earnings: [], 
          statistics: {
            total_revenue: 0,
            total_driver_earnings: 0,
            total_admin_earnings: 0,
            admin_percentage: 20,
            driver_percentage: 80,
            count: 0
          }
        } 
      };
    }
    console.error('Error fetching driver earnings:', error);
    throw error;
  }
}

/**
 * Get all driver earnings summary (aggregated by driver)
 * @returns {Promise<Object>} All drivers earnings data
 */
export async function getAllDriverEarnings() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${EARNINGS_API_BASE_URL}driver_earnings/`;
    
    console.log('Fetching all driver earnings from:', url);
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('All Driver Earnings API Error Response:', errorText);
      
      // Return empty data for server errors
      if (response.status >= 500) {
        console.warn('Server error, returning empty driver earnings data');
        return { success: true, data: [], count: 0 };
      }
      
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('All driver earnings response:', data);
    return data;
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('All driver earnings request aborted/timeout. Returning empty data.');
      return { success: true, data: [], count: 0 };
    }
    console.error('Error fetching all driver earnings:', error);
    throw error;
  }
}

/**
 * Get earnings statistics for the current driver
 * @param {string} driverId - The driver's ID
 * @param {string} period - Period for calculation ('today', 'week', 'month', 'all')
 * @returns {Promise<Object>} Earnings statistics
 */
export async function getDriverEarningsStats(driverId, period = 'month') {
  try {
    const filters = {};
    const now = new Date();
    
    switch (period) {
      case 'today': {
        const today = now.toISOString().split('T')[0];
        // IMPORTANT: do not set date_to to 'today' (midnight cap)
        filters.date_from = today;
        break;
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filters.date_from = weekAgo.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filters.date_from = monthAgo.toISOString().split('T')[0];
        break;
      }
      // 'all' => no date filter
    }
    
    const earningsData = await getDriverEarnings(driverId, filters);
    
    if (earningsData.success && earningsData.data) {
      const stats = earningsData.data.statistics;
      const earnings = earningsData.data.earnings || [];

      // Only count *finalized* entries dated today (local device date)
      const completedToday = earnings.filter(e => {
        const statusFinalized = String(e?.status || '').toLowerCase() === 'finalized';
        if (!statusFinalized) return false;
        const earningDate = e?.earning_date ? new Date(e.earning_date) : null;
        if (!earningDate || Number.isNaN(earningDate.getTime())) return false;
        const today = new Date();
        return earningDate.toDateString() === today.toDateString();
      });
      
      return {
        success: true,
        data: {
          ...stats,
          period,
          // Sum only finalized for "today"
          earnings_today: completedToday.reduce((sum, e) => sum + (Number(e?.driver_earnings) || 0), 0),
          completed_bookings_today: completedToday.length,
          avg_earning_per_booking: stats.count > 0 ? (stats.total_driver_earnings / stats.count) : 0,
          recent_earnings: earnings.slice(0, 5)
        }
      };
    }
    
    return earningsData;
  } catch (error) {
    console.error('Error fetching driver earnings stats:', error);
    throw error;
  }
}

/**
 * Calculate earnings percentage change
 * @param {string} driverId - The driver's ID
 * @param {string} currentPeriod - Current period ('week', 'month')
 * @returns {Promise<Object>} Percentage change data
 */
export async function getEarningsPercentageChange(driverId, currentPeriod = 'month') {
  try {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;
    
    if (currentPeriod === 'week') {
      // Current week
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      currentStart = weekAgo.toISOString().split('T')[0];
      currentEnd = now.toISOString().split('T')[0];
      
      // Previous week
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousStart = twoWeeksAgo.toISOString().split('T')[0];
      previousEnd = weekAgo.toISOString().split('T')[0];
    } else {
      // Current month
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      currentStart = monthAgo.toISOString().split('T')[0];
      currentEnd = now.toISOString().split('T')[0];
      
      // Previous month
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
      previousStart = twoMonthsAgo.toISOString().split('T')[0];
      previousEnd = monthAgo.toISOString().split('T')[0];
    }
    
    // Get current period earnings
    const currentEarnings = await getDriverEarnings(driverId, {
      date_from: currentStart,
      date_to: currentEnd
    });
    
    // Get previous period earnings
    const previousEarnings = await getDriverEarnings(driverId, {
      date_from: previousStart,
      date_to: previousEnd
    });
    
    const currentAmount = currentEarnings.success ? currentEarnings.data.statistics.total_driver_earnings : 0;
    const previousAmount = previousEarnings.success ? previousEarnings.data.statistics.total_driver_earnings : 0;
    
    let percentageChange = 0;
    let isIncrease = true;
    
    if (previousAmount > 0) {
      percentageChange = ((currentAmount - previousAmount) / previousAmount) * 100;
      isIncrease = percentageChange >= 0;
    } else if (currentAmount > 0) {
      percentageChange = 100; // If no previous earnings but has current
      isIncrease = true;
    }
    
    return {
      success: true,
      data: {
        current_amount: currentAmount,
        previous_amount: previousAmount,
        percentage_change: Math.abs(percentageChange),
        is_increase: isIncrease,
        period: currentPeriod
      }
    };
  } catch (error) {
    console.error('Error calculating earnings percentage change:', error);
    return {
      success: false,
      data: {
        current_amount: 0,
        previous_amount: 0,
        percentage_change: 0,
        is_increase: true,
        period: currentPeriod
      }
    };
  }
}

/**
 * Get the total pending payout amount for a specific driver (by user id).
 * Hits: GET /earnings/pending/
 * Returns: { success, data: { amount, payouts, count } }
 */
export async function getPendingPayoutAmount(driverId) {
  if (!driverId) {
    return { success: true, data: { amount: 0, payouts: [], count: 0 } };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const url = `${EARNINGS_API_BASE_URL}pending/`;
    const token = await getAccessToken().catch(() => null);

    const resp = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Pending payouts API error:', txt);
      throw new Error(`HTTP ${resp.status}: ${txt.substring(0, 200)}`);
    }

    const rows = await resp.json(); // array of { id, driver_id, driver_name, total_amount, payout_date, remarks, status }
    const mine = (Array.isArray(rows) ? rows : []).filter(
      (p) => String(p?.driver_id || '') === String(driverId) && String(p?.status || '').toLowerCase() === 'pending'
    );

    // There should be at most one pending per driver, but we sum to be safe.
    const amount = mine.reduce((s, r) => s + (Number(r?.total_amount) || 0), 0);

    return { success: true, data: { amount, payouts: mine, count: mine.length } };
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('Pending payouts request aborted/timeout. Returning zero.');
      return { success: true, data: { amount: 0, payouts: [], count: 0 } };
    }
    console.error('Error fetching pending payout amount:', error);
    throw error;
  }
}


/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '₱0.00';
  return `₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format percentage
 * @param {number} percentage - Percentage to format
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(percentage) {
  if (!percentage || isNaN(percentage)) return '0.0%';
  return `${parseFloat(percentage).toFixed(1)}%`;
}
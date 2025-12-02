// services/Earnings/EarningsService.js
import { apiClient } from '../improvedApiClient';
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';
import { supabase } from '../supabase';

const DEBUG_EARNINGS = __DEV__;
const log = (...a) => DEBUG_EARNINGS && console.log('[EARNINGS]', ...a);

const EARNINGS_API_BASE_URL = `${apiBaseUrl()}/earnings/`;

/* ----------------------------- Date utilities ----------------------------- */
function toLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeekMonday(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = d.getDay();
  const offset = (dow + 6) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeekExclusive(base = new Date()) {
  const start = startOfWeekMonday(base);
  return addDays(start, 7);
}
function previousWeekExclusiveRange(now = new Date()) {
  const thisMon = startOfWeekMonday(now);
  const prevMon = addDays(thisMon, -7);
  return { start: toLocalYMD(prevMon), end: toLocalYMD(thisMon) };
}
function startOfMonth(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth(), 1);
}
function startOfNextMonth(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth() + 1, 1);
}

/* ------------------------- Supabase row helpers --------------------------- */
function parseAmountLike(row) {
  const amount = Number(row?.amount ?? 0) || 0;
  const packageName = String(row?.package_name || '').toLowerCase();
  const isRideHailing = packageName.includes('ride') || packageName.includes('hailing');
  const driverShare = isRideHailing ? 1.0 : 0.8;
  const drv = amount * driverShare;
  const adm = amount * (1 - driverShare);
  
  if (isRideHailing) {
    console.log('[RIDE_HAILING_DEBUG] Package:', packageName, 'Amount:', amount, 'Driver gets:', drv, '(100%)');
  }
  
  log('parseAmountLike:', {
    packageName,
    isRideHailing,
    driverShare,
    amount,
    drv,
    adm
  });
  
  return { amount, drv, adm };
}
function statusIsReversed(row) {
  const s = String(row?.status || '').toLowerCase().trim();
  return s === 'reversed';
}

/* Robust local-date parser */
function parseDateSafely(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d, 0, 0, 0, 0);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/* ------------------------- Supabase fetch variants ------------------------ */
async function fetchEarningsRowsFromSupabase(driverId, filters = {}, mode = 'iso') {
  let q = supabase
    .from('earnings')
    .select('id, amount, status, earning_date, driver_id, package_name');

  q = q.eq('driver_id', String(driverId));

  if (filters.date_from) {
    if (mode === 'iso') {
      const iso = new Date(`${filters.date_from}T00:00:00`).toISOString();
      q = q.gte('earning_date', iso);
    } else {
      q = q.gte('earning_date', filters.date_from);
    }
  }
  if (filters.date_to) {
    if (mode === 'iso') {
      const iso = new Date(`${filters.date_to}T00:00:00`).toISOString();
      q = q.lt('earning_date', iso);
    } else {
      q = q.lt('earning_date', filters.date_to); // exclusive upper bound
    }
  }

  const { data, error } = await q.order('earning_date', { ascending: false });
  if (error) {
    log(`Supabase (${mode}) error:`, error.message);
    return [];
  }
  const rows = (data || []).filter((r) => !statusIsReversed(r));
  log(`Supabase (${mode}) rows:`, rows.length);
  return rows;
}

function aggregateEarnings(rows) {
  let totalRevenue = 0;
  let totalDriver = 0;
  let totalAdmin = 0;

  log('aggregateEarnings input rows:', rows.length);

  const out = rows.map((r) => {
    const amount = Number(r?.amount ?? 0) || 0;
    const packageName = String(r?.package_name || '').toLowerCase();
    const isRideHailing = packageName.includes('ride') || packageName.includes('hailing');
    
    // Always recalculate based on package type, ignore existing driver_earnings
    const driverShare = isRideHailing ? 1.0 : 0.8;
    const drv = amount * driverShare;
    const adm = amount * (1 - driverShare);
    
    if (isRideHailing) {
      console.log('[BACKEND_RIDE_HAILING] Package:', packageName, 'Amount:', amount, 'Driver gets:', drv, '(100%)');
    }
    
    totalRevenue += amount;
    totalDriver += drv;
    totalAdmin += adm;
    
    return {
      id: r.id,
      package_name: r.package_name || 'Tour Package',
      earning_date: r.earning_date,
      status: r.status,
      total_amount: amount,
      driver_earnings: drv,
      admin_earnings: adm,
    };
  });

  const driverPercentage = totalRevenue > 0 ? Math.round((totalDriver / totalRevenue) * 100) : 80;
  const adminPercentage = 100 - driverPercentage;

  log('aggregateEarnings result:', {
    totalRevenue,
    totalDriver,
    totalAdmin,
    driverPercentage,
    adminPercentage,
    count: out.length
  });

  return {
    earnings: out,
    statistics: {
      total_revenue: totalRevenue,
      total_driver_earnings: totalDriver,
      total_admin_earnings: totalAdmin,
      admin_percentage: adminPercentage,
      driver_percentage: driverPercentage,
      count: out.length,
    },
  };
}

/* ------------------------------ Fallbacks --------------------------------- */
async function computeFromSupabaseRobust(driverId, filters = {}) {
  const isoRows = await fetchEarningsRowsFromSupabase(driverId, filters, 'iso');
  if (isoRows.length > 0) {
    log('Using Supabase ISO rows');
    return { success: true, data: aggregateEarnings(isoRows) };
  }

  const ymdRows = await fetchEarningsRowsFromSupabase(driverId, filters, 'ymd');
  if (ymdRows.length > 0) {
    log('Using Supabase YMD rows');
    return { success: true, data: aggregateEarnings(ymdRows) };
  }

  try {
    const url = `${EARNINGS_API_BASE_URL}driver_earnings/`;
    const token = await getAccessToken().catch(() => null);
    const res = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (res.ok) {
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      const mine = items.find((x) => String(x?.driver_id || '') === String(driverId));
      if (mine) {
        log('Using backend aggregated driver_earnings fallback');
        return {
          success: true,
          data: {
            earnings: mine.recent_bookings || [],
            statistics: {
              total_revenue: Number(mine.total_revenue || 0),
              total_driver_earnings: Number(mine.total_driver_earnings || 0),
              total_admin_earnings: Number(mine.total_admin_earnings || 0),
              admin_percentage: 20,
              driver_percentage: 80,
              count: Number(mine.total_bookings || 0),
            },
          },
        };
      }
    }
  } catch (e) {
    log('driver_earnings fallback failed:', e?.message || e);
  }

  log('All fallbacks yielded 0 rows');
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
        count: 0,
      },
    },
  };
}

/* --------------------------------- API ----------------------------------- */
export async function getDriverEarnings(driverId, filters = {}) {
  try {
    const qs = new URLSearchParams();
    if (driverId !== undefined && driverId !== null && driverId !== '') {
      qs.append('driver_id', driverId);
    }
    Object.keys(filters).forEach((k) => {
      const v = filters[k];
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });

    const endpoint = `/earnings/mobile_earnings/?${qs.toString()}`;
    log('Calling API:', endpoint);
    
    const result = await apiClient.get(endpoint, { timeout: 30000 });

    if (result.success) {
      const data = result.data;
      const stats = data?.data?.statistics || {};
      const hadData =
        (Array.isArray(data?.data?.earnings) && data.data.earnings.length > 0) ||
        Number(stats?.total_driver_earnings || 0) > 0 ||
        Number(stats?.count || 0) > 0;

      log('API stats:', { count: stats?.count, total_driver_earnings: stats?.total_driver_earnings, hadData });

      if (data?.success) {
        // Always respect API response when successful, even if empty
        return data;
      }
      return await computeFromSupabaseRobust(driverId, filters);
    }

    log('API non-OK, status:', result.status);
    return await computeFromSupabaseRobust(driverId, filters);
  } catch (err) {
    log('API error, falling back:', err?.message || err);
    return await computeFromSupabaseRobust(driverId, filters);
  }
}

/**
 * Aggregate stats for the selected period (today/week/month/all) or custom date range
 * Default ranges are: today [00:00, +1d), week Mon..Sun, month 1st..last.
 */
export async function getDriverEarningsStats(driverId, period = 'month', customDateRange = null) {
  const filters = {};
  const now = new Date();

  let period_from = null;
  let period_to = null;

  // Custom date range first
  if (customDateRange && customDateRange.from && customDateRange.to) {
    filters.date_from = customDateRange.from;
    const endDate = new Date(customDateRange.to);
    endDate.setDate(endDate.getDate() + 1); // exclusive
    filters.date_to = toLocalYMD(endDate);
    period_from = customDateRange.from;
    period_to = customDateRange.to;
  } else {
    switch (period) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endExcl = addDays(start, 1);
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        period_from = toLocalYMD(start);
        period_to = toLocalYMD(start);
        break;
      }
      case 'week': {
        const start = startOfWeekMonday(now);
        const endExcl = endOfWeekExclusive(now);
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        period_from = toLocalYMD(start);
        period_to = toLocalYMD(addDays(endExcl, -1));
        break;
      }
      case 'month': {
        const start = startOfMonth(now);
        const endExcl = startOfNextMonth(now);
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        period_from = toLocalYMD(start);
        period_to = toLocalYMD(addDays(endExcl, -1));
        break;
      }
      // 'all' → no filters
    }
  }

  const earningsData = await getDriverEarnings(driverId, filters);
  log('Stats raw:', earningsData, 'Filters:', filters);

  if (earningsData.success && earningsData.data) {
    const stats = earningsData.data.statistics || {};
    const earnings = Array.isArray(earningsData.data.earnings) ? earningsData.data.earnings : [];

    // Always calculate today's earnings for dashboard display
    let earnings_today = 0;
    let completed_bookings_today = 0;
    
    const today = new Date();
    const todayYMD = toLocalYMD(today);

    const todayRows = earnings.filter((e) => {
      const s = String(e?.status || '').toLowerCase();
      if (s === 'reversed') return false;
      
      // Extract date part from earning_date and compare with today's date
      const earningDate = e?.earning_date;
      if (!earningDate) return false;
      
      // Get just the date part (YYYY-MM-DD) from the earning_date
      const earningYMD = earningDate.split('T')[0]; // Handle ISO format
      return earningYMD === todayYMD;
    });

    earnings_today = todayRows.reduce((sum, e) => {
      const base = Number(e?.amount ?? 0);
      const packageName = String(e?.package_name || '').toLowerCase();
      const isRideHailing = packageName.includes('ride') || packageName.includes('hailing');
      const driverShare = isRideHailing ? 1.0 : 0.8;
      const drv = base * driverShare;
      return sum + (Number.isFinite(drv) ? drv : 0);
    }, 0);
    
    completed_bookings_today = todayRows.length;

    const result = {
      ...stats,
      period,
      period_from,
      period_to,
      earnings_today,
      completed_bookings_today,
      avg_earning_per_booking:
        Number(stats.count || 0) > 0 ? Number(stats.total_driver_earnings || 0) / Number(stats.count) : 0,
      recent_earnings: earnings.slice(0, 5),
    };
    log('Stats computed:', result);

    return { success: true, data: result };
  }

  return earningsData;
}

/**
 * Month/Week % change
 */
export async function getEarningsPercentageChange(driverId, currentPeriod = 'month') {
  try {
    const now = new Date();
    let currentStart, currentEndExcl, previousStart, previousEndExcl;

    if (currentPeriod === 'week') {
      const thisMon = startOfWeekMonday(now);
      const nextMon = endOfWeekExclusive(now);
      currentStart = toLocalYMD(thisMon);
      currentEndExcl = toLocalYMD(nextMon);
      const prev = previousWeekExclusiveRange(now);
      previousStart = prev.start;
      previousEndExcl = prev.end;
    } else {
      const curStart = startOfMonth(now);
      const curEndExcl = startOfNextMonth(now);
      const prevStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const prevEndExcl = startOfMonth(now);
      currentStart = toLocalYMD(curStart);
      currentEndExcl = toLocalYMD(curEndExcl);
      previousStart = toLocalYMD(prevStart);
      previousEndExcl = toLocalYMD(prevEndExcl);
    }

    const cur = await getDriverEarnings(driverId, { date_from: currentStart, date_to: currentEndExcl });
    const prev = await getDriverEarnings(driverId, { date_from: previousStart, date_to: previousEndExcl });

    const currentAmount = cur.success ? Number(cur.data.statistics.total_driver_earnings || 0) : 0;
    const previousAmount = prev.success ? Number(prev.data.statistics.total_driver_earnings || 0) : 0;

    let change = 0;
    let up = true;
    if (previousAmount > 0) {
      change = ((currentAmount - previousAmount) / previousAmount) * 100;
      up = change >= 0;
    } else if (currentAmount > 0) {
      change = 100;
      up = true;
    }

    return {
      success: true,
      data: {
        current_amount: currentAmount,
        previous_amount: previousAmount,
        percentage_change: Math.abs(change),
        is_increase: up,
        period: currentPeriod,
      },
    };
  } catch (e) {
    log('getEarningsPercentageChange error:', e?.message || e);
    return {
      success: false,
      data: { current_amount: 0, previous_amount: 0, percentage_change: 0, is_increase: true, period: currentPeriod },
    };
  }
}

/* ------------------------------- Formatters ------------------------------- */
export function formatCurrency(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0.00';
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatPercentage(percentage) {
  const n = Number(percentage);
  if (!Number.isFinite(n)) return '0.0%';
  return `${n.toFixed(1)}%`;
}

/**
 * Get weekly activity data for driver dashboard chart
 */
export async function getDriverWeeklyActivity(driverId) {
  if (__DEV__) {
    console.log('[WEEKLY-API] Starting getDriverWeeklyActivity for driver:', driverId);
  }
  try {
    const endpoint = `/earnings/weekly_activity/?driver_id=${encodeURIComponent(driverId)}`;
    
    if (__DEV__) {
      console.log('[WEEKLY-API] Endpoint:', endpoint);
    }

    log('Calling weekly activity API:', endpoint);
    
    const result = await apiClient.get(endpoint, { timeout: 30000 });

    console.log('[WEEKLY-API] Response status:', result.status);
    log('Weekly activity response status:', result.status);
    
    if (result.success) {
      const data = result.data;
      console.log('[WEEKLY-API] Response data:', data);
      log('Weekly activity response data:', data);
      return data;
    } else {
      console.log('[WEEKLY-API] Error response:', result.error);
      log('Weekly activity API error response:', result.error);
      return {
        success: false,
        error: result.error || `HTTP ${result.status}`,
        data: []
      };
    }
  } catch (err) {
    console.log('[WEEKLY-API] Exception:', err);
    log('Weekly activity API error:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Network error',
      data: []
    };
  }
}

/**
 * Pending payout amount (admin payouts list, filtered for this driver)
 */
export async function getPendingPayoutAmount(driverId) {
  if (!driverId) {
    return { success: true, data: { amount: 0, payouts: [], count: 0 } };
  }

  try {
    const result = await apiClient.get('/earnings/pending/', { timeout: 30000 });

    if (!result.success) {
      console.error('Pending payouts API error:', result.error);
      throw new Error(result.error || 'Failed to fetch pending payouts');
    }

    const rows = result.data;
    const mine = (Array.isArray(rows) ? rows : []).filter(
      (p) => String(p?.driver_id || '') === String(driverId) && String(p?.status || '').toLowerCase() === 'pending'
    );

    const amount = mine.reduce((s, r) => s + (Number(r?.total_amount) || 0), 0);
    return { success: true, data: { amount, payouts: mine, count: mine.length } };
  } catch (error) {
    if (error?.message?.includes('timeout')) {
      console.warn('Pending payouts request timeout. Returning zero.');
      return { success: true, data: { amount: 0, payouts: [], count: 0 } };
    }
    console.error('Error fetching pending payout amount:', error);
    throw error;
  }
}

/**
 * Get driver payout history - released payouts for the driver
 */
export async function getDriverPayoutHistory(driverId) {
  try {
    const endpoint = `/earnings/payout_history/?driver_id=${encodeURIComponent(driverId)}`;
    log('Calling payout history API:', endpoint);
    
    const result = await apiClient.get(endpoint, { timeout: 30000 });

    if (result.success) {
      const data = result.data;
      log('Payout history response:', data);
      return data;
    }

    // Fallback to Supabase if API fails
    log('API failed, falling back to Supabase');
    const { data, error } = await supabase
      .from('payouts')
      .select('id, driver_id, driver_name, total_amount, payout_date, payout_method, status, remarks')
      .eq('driver_id', driverId)
      .order('payout_date', { ascending: false });

    if (error) {
      log('Supabase payout error:', error.message);
      return { success: false, error: error.message, data: [] };
    }

    return {
      success: true,
      data: (data || []).map(payout => ({
        id: payout.id,
        amount: Number(payout.total_amount || 0),
        status: payout.status || 'pending',
        payout_date: payout.payout_date,
        reference_number: payout.id, // Use ID as reference since no reference_number field
        method: payout.payout_method || 'bank_transfer',
      }))
    };
  } catch (err) {
    log('Payout history error:', err?.message || err);
    return { success: false, error: err?.message || 'Network error', data: [] };
  }
}

export const _dateHelpers = {
  toLocalYMD,
  addDays,
  startOfWeekMonday,
  endOfWeekExclusive,
  previousWeekExclusiveRange,
  startOfMonth,
  startOfNextMonth,
};

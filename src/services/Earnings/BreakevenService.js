// services/Earnings/BreakevenService.js
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';
import { supabase } from '../supabase';
import { getPhTodayUtcWindow, toPhilippinesYMD } from '../../utils/timezone';

const EARNINGS_API_BASE_URL = `${apiBaseUrl()}/breakeven/`;

/**
 * GET /breakeven/?driver_id=&period=&expenses=&display_tz=&bucket_tz=
 * - period: "today" | "week" | "month"
 * - display_tz: "ph" | "utc" (formatting only)
 * - bucket_tz: "ph" | "utc"  (how days/weeks/months are bucketed)
 */
export async function getBreakeven({
  driverId,
  period = 'today',
  expenses = 0,
  displayTz = 'ph',
  bucketTz = 'ph',
  statusIn,        // optional CSV (e.g. "finalized,completed,pending")
  statusExclude,   // optional CSV
  debug,
}) {
  const params = new URLSearchParams();
  if (driverId) params.append('driver_id', String(driverId));
  if (period) params.append('period', String(period));
  params.append('expenses', Number(expenses || 0).toString());
  params.append('display_tz', displayTz);
  params.append('bucket_tz', bucketTz);
  if (statusIn) params.append('status_in', statusIn);
  if (statusExclude) params.append('status_exclude', statusExclude);
  if (debug) params.append('debug', '1');

  const url = `${EARNINGS_API_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const token = await getAccessToken().catch(() => null);
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: text || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    return { success: false, error: e?.message || 'Network error' };
  }
}

/**
 * GET /breakeven/history?driver_id=&period_type=&limit=&exclude_current=1&offset=
 * Bucketing for history follows the server's DEFAULT_BUCKET_TZ (env).
 */
export async function getBreakevenHistory({
  driverId,
  periodType = 'daily',
  limit = 30,
  excludeCurrent = true,
  offset = 0,
  dateFrom,
  dateTo,
}) {
  const params = new URLSearchParams();
  if (driverId) params.append('driver_id', String(driverId));
  if (periodType) params.append('period_type', String(periodType));
  if (limit) params.append('limit', String(limit));
  if (excludeCurrent) params.append('exclude_current', '1');
  if (offset) params.append('offset', String(offset));
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);

  const url = `${EARNINGS_API_BASE_URL}history?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const token = await getAccessToken().catch(() => null);
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      // Return empty list gracefully
      return { success: true, data: { items: [] } };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    // Fail soft with empty items so the UI can show a fallback message
    return { success: true, data: { items: [] } };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Persist user's expense cache so server-side snapshots (cron) use the same amount.
 * Safe to call often; upserts on driver_id.
 */
export async function setBreakevenExpenseCache(driverId, expenses) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    const row = {
      driver_id: driverId,
      expenses: Number(expenses || 0),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('breakeven_expense_cache')
      .upsert(row, { onConflict: 'driver_id' });
    if (error) return { success: false, error: error.message || 'supabase error' };
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Get stored expenses from today's breakeven_history
 */
export async function getTodayExpenses(driverId) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    
    // Get today's date in PH timezone
    const now = new Date();
    const phOffset = 8 * 60; // PH is UTC+8
    const phTime = new Date(now.getTime() + (phOffset * 60 * 1000));
    const todayStart = new Date(phTime.getFullYear(), phTime.getMonth(), phTime.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    // Convert back to UTC for database query
    const startUtc = new Date(todayStart.getTime() - (phOffset * 60 * 1000));
    const endUtc = new Date(todayEnd.getTime() - (phOffset * 60 * 1000));
    
    const { data, error } = await supabase
      .from('breakeven_history')
      .select('expenses')
      .eq('driver_id', driverId)
      .eq('period_type', 'daily')
      .gte('period_start', startUtc.toISOString())
      .lt('period_start', endUtc.toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) return { success: false, error: error.message };
    return { success: true, expenses: Number(data?.expenses || 0) };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Sum expenses from breakeven_history over a PH-bucketed range (weekly/monthly).
 * Provide startUtc / endUtc as UTC ISO bounds corresponding to PH local 00:00..next 00:00.
 * Uses period_type='daily' rows and sums `expenses`.
 */
export async function getExpensesSumInRange(driverId, startUtcISO, endUtcISO) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    if (!startUtcISO || !endUtcISO) return { success: false, error: 'bounds required' };

    const { data, error } = await supabase
      .from('breakeven_history')
      .select('expenses')
      .eq('driver_id', driverId)
      .eq('period_type', 'daily')
      .gte('period_start', startUtcISO)
      .lt('period_start', endUtcISO);

    if (error) return { success: false, error: error.message };

    const sum = (data || []).reduce((s, r) => s + (Number(r?.expenses) || 0), 0);
    return { success: true, expenses: Number(sum.toFixed(2)) };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Get stored expenses from cache
 */
export async function getBreakevenExpenseCache(driverId) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    const { data, error } = await supabase
      .from('breakeven_expense_cache')
      .select('expenses')
      .eq('driver_id', driverId)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, expenses: Number(data?.expenses || 0) };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Get breakeven history directly from Supabase with proper filtering
 */
export async function getBreakevenHistoryDirect({
  driverId,
  periodType = 'daily',
  limit = 30,
  offset = 0,
  excludeCurrent = false,
}) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    
    let query = supabase
      .from('breakeven_history')
      .select('*')
      .eq('driver_id', driverId)
      .eq('period_type', periodType);
    
    // For daily, exclude today's record (PH timezone)
    if (periodType === 'daily' && excludeCurrent) {
      const now = new Date();
      const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
      const todayPH = phTime.toISOString().split('T')[0];
      const todayStartPH = `${todayPH}T00:00:00+08:00`;
      
      query = query.lt('period_start', todayStartPH);
    }
    
    const { data, error } = await query
      .order('period_start', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) return { success: false, error: error.message };
    return { success: true, data: { items: data || [] } };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Upsert a daily row in breakeven_history using the latest /breakeven summary.
 * Unique key: (driver_id, period_type, period_start)
 */
export async function upsertBreakevenHistoryFromSummary({
  driverId,
  summary,
  expenses = 0,
  periodType = 'daily',
}) {
  try {
    if (!driverId || !summary?.date_start || !summary?.date_end) {
      return { success: false, error: 'invalid params' };
    }

    // Get total earnings including ride hailing
    const period = periodType === 'daily' ? 'today' : periodType === 'weekly' ? 'week' : 'month';
    const earningsRes = await getTotalDriverEarnings(driverId, period);
    
    // Use earnings data if available, otherwise fallback to summary
    const revenue = earningsRes?.success && earningsRes.data.total_earnings > 0 
      ? Number(earningsRes.data.total_earnings || 0) 
      : Number(summary.revenue_period || 0);
    
    const exps = Number(expenses || 0);
    const profit = Number((revenue - exps).toFixed(2));

    const breakdown = {
      standard_share: earningsRes?.success ? Number(earningsRes.data.standard_earnings || 0) : Number(summary?.breakdown?.driver_share_from_standard || 0),
      ride_hailing_share: earningsRes?.success ? Number(earningsRes.data.ride_hailing_earnings || 0) : Number(summary?.breakdown?.driver_share_from_ride_hailing || summary?.breakdown?.driver_share_from_custom || 0),
    };

    const row = {
      driver_id: driverId,
      period_type: periodType,
      period_start: summary.date_start,
      period_end: summary.date_end,
      expenses: exps,
      revenue_driver: revenue,
      profit,
      rides_needed: Number(summary.bookings_needed || 0),
      rides_done: earningsRes?.success ? Number(earningsRes.data.count || 0) : Number(summary.total_bookings || 0),
      breakeven_hit: profit >= 0,
      profitable: profit > 0,
      breakdown,
      snapshot_at: new Date().toISOString(),
      role: 'driver',
      bucket_tz: 'ph',
    };

    // Keep server cron in sync with the same expenses value (daily use)
    await setBreakevenExpenseCache(driverId, exps);

    const { data, error } = await supabase
      .from('breakeven_history')
      .upsert(row, { onConflict: 'driver_id,role,period_type,period_start' })
      .select();

    if (error) {
      console.error('Error upserting breakeven history:', error);
      return { success: false, error: error.message || 'supabase error' };
    }
    
    console.log('Breakeven history upserted with revenue:', revenue, 'for period:', periodType);
    return { success: true, data };
  } catch (e) {
    console.error('Upsert breakeven history error:', e);
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Get owner breakeven history from Supabase
 */
export async function getOwnerBreakevenHistory({
  driverId,
  periodType = 'daily',
  limit = 30,
  offset = 0,
  excludeCurrent = false,
}) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    
    let query = supabase
      .from('breakeven_history')
      .select('*')
      .eq('driver_id', driverId)
      .eq('period_type', periodType)
      .eq('role', 'owner');
    
    if (excludeCurrent) {
      const now = new Date();
      const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      
      if (periodType === 'daily') {
        const todayPH = phTime.toISOString().split('T')[0];
        const todayStartPH = `${todayPH}T00:00:00+08:00`;
        query = query.lt('period_start', todayStartPH);
      } else if (periodType === 'weekly') {
        // Exclude current week
        const currentWeekStart = new Date(phTime);
        const dayOfWeek = currentWeekStart.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
        currentWeekStart.setHours(0, 0, 0, 0);
        const currentWeekStartUTC = new Date(currentWeekStart.getTime() - (8 * 60 * 60 * 1000));
        query = query.lt('period_start', currentWeekStartUTC.toISOString());
      } else if (periodType === 'monthly') {
        // Exclude current month
        const currentMonthStart = new Date(phTime.getFullYear(), phTime.getMonth(), 1);
        const currentMonthStartUTC = new Date(currentMonthStart.getTime() - (8 * 60 * 60 * 1000));
        query = query.lt('period_start', currentMonthStartUTC.toISOString());
      }
    }
    
    const { data, error } = await query
      .order('period_start', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) return { success: false, error: error.message };
    return { success: true, data: { items: data || [] } };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Save complete breakeven data to breakeven_history
 */
export async function saveExpensesForPeriod({
  driverId,
  periodType,
  periodStart,
  periodEnd,
  expenses = 0,
  breakevenData = null,
}) {
  try {
    if (!driverId || !periodType || !periodStart || !periodEnd) {
      return { success: false, error: 'Missing required parameters' };
    }

    const exps = Number(expenses || 0);
    const role = 'driver';
    
    // Get total earnings including ride hailing
    const period = periodType === 'daily' ? 'today' : periodType === 'weekly' ? 'week' : 'month';
    const earningsRes = await getTotalDriverEarnings(driverId, period);
    
    console.log(`[BreakevenService] Earnings result for ${period}:`, earningsRes);
    
    const revenue = earningsRes?.success ? Number(earningsRes.data.total_earnings || 0) : Number(breakevenData?.revenue_period || 0);
    const profit = Number((revenue - exps).toFixed(2));
    const ridesNeeded = Number(breakevenData?.bookings_needed || 0);
    const ridesDone = earningsRes?.success ? Number(earningsRes.data.count || 0) : Number(breakevenData?.total_bookings || 0);
    
    const breakdown = earningsRes?.success ? {
      standard_share: Number(earningsRes.data.standard_earnings || 0),
      ride_hailing_share: Number(earningsRes.data.ride_hailing_earnings || 0),
    } : (breakevenData?.breakdown || {});

    const row = {
      driver_id: driverId,
      role: role,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      expenses: exps,
      revenue_driver: revenue,
      profit: profit,
      rides_needed: ridesNeeded,
      rides_done: ridesDone,
      breakeven_hit: profit >= 0,
      profitable: profit > 0,
      breakdown: breakdown,
      snapshot_at: new Date().toISOString(),
      bucket_tz: 'ph',
    };

    console.log(`[BreakevenService] Saving breakeven data with revenue: ₱${revenue} for ${periodType}:`, row);

    const { data, error } = await supabase
      .from('breakeven_history')
      .upsert(row, { onConflict: 'driver_id,role,period_type,period_start' })
      .select();

    if (error) {
      console.error('Supabase error saving breakeven data:', error);
      return { success: false, error: error.message || 'supabase error' };
    }
    
    console.log('Complete breakeven data saved with revenue:', data?.[0]?.revenue_driver);
    return { success: true, data };
  } catch (e) {
    console.error('Save breakeven data error:', e);
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

/**
 * Save owner breakeven history based on manual inputs and selected period
 */
export async function saveOwnerBreakevenHistory({
  driverId,
  periodType,
  periodStart,
  periodEnd,
  expenses = 0,
  revenue = 0,
  ridesNeeded = 0,
  ridesDone = 0,
  breakdown = {},
}) {
  try {
    if (!driverId || !periodType || !periodStart || !periodEnd) {
      return { success: false, error: 'Missing required parameters' };
    }

    const exps = Number(expenses || 0);
    const rev = Number(revenue || 0);
    const profit = Number((rev - exps).toFixed(2));

    const row = {
      driver_id: driverId,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      expenses: exps,
      revenue_driver: rev,
      profit,
      rides_needed: Number(ridesNeeded || 0),
      rides_done: Number(ridesDone || 0),
      breakeven_hit: profit >= 0,
      profitable: profit > 0,
      breakdown: breakdown || {},
      snapshot_at: new Date().toISOString(),
      bucket_tz: 'ph',
      day_cutoff_hour: null,
      role: 'owner',
    };

    const { data, error } = await supabase
      .from('breakeven_history')
      .upsert(row, { onConflict: 'driver_id,role,period_type,period_start' })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message || 'supabase error' };
    }
    
    console.log('Owner breakeven history saved:', data);
    return { success: true, data };
  } catch (e) {
    console.error('Save error:', e);
    return { success: false, error: e?.message || 'unexpected error' };
  }
}
/**
 * Get total driver earnings including ride hailing for a period
 */
export async function getTotalDriverEarnings(driverId, period) {
  try {
    if (!driverId) return { success: false, error: 'driverId required' };
    
    let startUtc, endUtc;
    if (period === 'today') {
      [startUtc, endUtc] = getPhTodayUtcWindow();
    } else if (period === 'week') {
      [startUtc, endUtc] = getPhWeekUtcWindow();
    } else if (period === 'month') {
      [startUtc, endUtc] = getPhMonthUtcWindow();
    } else {
      return { success: false, error: 'Invalid period' };
    }

    console.log(`[getTotalDriverEarnings] Querying earnings for driver ${driverId}, period ${period}`);
    console.log(`[getTotalDriverEarnings] Date range: ${startUtc} to ${endUtc}`);
    
    const { data, error } = await supabase
      .from('earnings')
      .select('driver_earnings, amount, total_amount, booking_id, custom_tour_id, ride_hailing_booking_id, booking_type, organization_percentage, earning_date, status')
      .eq('driver_id', driverId)
      .gte('earning_date', startUtc)
      .lt('earning_date', endUtc)
      .in('status', ['finalized', 'posted', 'completed', 'pending']);

    if (error) {
      console.error(`[getTotalDriverEarnings] Query error:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`[getTotalDriverEarnings] Found ${data?.length || 0} earnings records`);

    let totalEarnings = 0;
    let standardEarnings = 0;
    let rideHailingEarnings = 0;
    let count = 0;

    for (const row of data || []) {
      let driverEarnings = Number(row.driver_earnings || 0);
      
      console.log(`[getTotalDriverEarnings] Processing record: driver_earnings=${row.driver_earnings}, amount=${row.amount}, status=${row.status}`);
      
      // If driver_earnings is 0 or null, calculate from amount
      if (driverEarnings === 0 && row.amount) {
        const totalAmount = Number(row.amount || 0);
        const orgPercentage = Number(row.organization_percentage || 20) / 100;
        driverEarnings = totalAmount * (1 - orgPercentage);
        console.log(`[getTotalDriverEarnings] Calculated driver earnings: ${driverEarnings} from amount ${totalAmount} with org percentage ${orgPercentage * 100}%`);
      }
      
      if (driverEarnings > 0) {
        totalEarnings += driverEarnings;
        
        // Categorize earnings based on booking type
        if (row.booking_id || row.custom_tour_id) {
          standardEarnings += driverEarnings;
          console.log(`[getTotalDriverEarnings] Added ${driverEarnings} to standard earnings`);
        } else if (row.ride_hailing_booking_id) {
          rideHailingEarnings += driverEarnings;
          console.log(`[getTotalDriverEarnings] Added ${driverEarnings} to ride hailing earnings`);
        } else {
          // Default to standard if booking type is unclear
          standardEarnings += driverEarnings;
          console.log(`[getTotalDriverEarnings] Added ${driverEarnings} to standard earnings (default)`);
        }
        
        count++;
      } else {
        console.log(`[getTotalDriverEarnings] Skipped record with zero earnings`);
      }
    }
    
    console.log(`[getTotalDriverEarnings] Final totals: total=${totalEarnings}, standard=${standardEarnings}, ride_hailing=${rideHailingEarnings}, count=${count}`);

    const result = {
      success: true,
      data: {
        total_earnings: Number(totalEarnings.toFixed(2)),
        standard_earnings: Number(standardEarnings.toFixed(2)),
        ride_hailing_earnings: Number(rideHailingEarnings.toFixed(2)),
        count
      }
    };
    
    console.log(`[getTotalDriverEarnings] Returning result:`, result);
    return result;
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

// Helper functions for date windows
// Using centralized timezone utility

function getPhWeekUtcWindow() {
  const PH_OFFSET_HOURS = 8;
  const now = new Date();
  const nowPh = new Date(now.getTime() + PH_OFFSET_HOURS * 3600_000);
  const d = new Date(Date.UTC(nowPh.getUTCFullYear(), nowPh.getUTCMonth(), nowPh.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - dow);
  const nextMon = new Date(mon); nextMon.setUTCDate(mon.getUTCDate() + 7);
  const startUtc = new Date(mon.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  const endUtc = new Date(nextMon.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  return [startUtc, endUtc];
}

function getPhMonthUtcWindow() {
  const PH_OFFSET_HOURS = 8;
  const now = new Date();
  const nowPh = new Date(now.getTime() + PH_OFFSET_HOURS * 3600_000);
  const y = nowPh.getUTCFullYear();
  const m = nowPh.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const nextFirst = new Date(Date.UTC(y, m + 1, 1));
  const startUtc = new Date(first.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  const endUtc = new Date(nextFirst.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  return [startUtc, endUtc];
}
// services/Earnings/BreakevenService.js
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';
import { supabase } from '../supabase';

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

    const revenue = Number(summary.revenue_period || 0);
    const exps    = Number(expenses || 0);
    const profit  = Number((revenue - exps).toFixed(2));

    const breakdown = {
      standard_share: Number(summary?.breakdown?.driver_share_from_standard || 0),
      custom_share:   Number(summary?.breakdown?.driver_share_from_custom || 0),
    };

    const row = {
      driver_id: driverId,
      period_type: periodType,
      period_start: summary.date_start,
      period_end:   summary.date_end,
      expenses: exps,
      revenue_driver: revenue,
      profit,
      rides_needed: Number(summary.bookings_needed || 0),
      rides_done:   Number(summary.total_bookings || 0),
      breakeven_hit: profit >= 0,
      profitable: profit > 0,
      breakdown,
      snapshot_at: new Date().toISOString(),
    };

    // Keep server cron in sync with the same expenses value (daily use)
    await setBreakevenExpenseCache(driverId, exps);

    const { error } = await supabase
      .from('breakeven_history')
      .upsert(row, { onConflict: 'driver_id,period_type,period_start' });

    if (error) return { success: false, error: error.message || 'supabase error' };
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'unexpected error' };
  }
}

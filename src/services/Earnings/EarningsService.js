// services/Earnings/EarningsService.js
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';
import { supabase } from '../supabase'; // used by fallbacks

// Toggle to see logs in Metro
const DEBUG_EARNINGS = false;
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
  const dow = d.getDay(); // 0 Sun .. 6 Sat
  const offset = (dow + 6) % 7; // 0 if Mon, 6 if Sun
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
  // Prefer explicit fields; else split
  const amount = Number(row?.amount ?? row?.total_amount ?? 0) || 0;
  const drv = row?.driver_earnings != null ? Number(row.driver_earnings) : amount * 0.8;
  const adm = row?.admin_earnings != null ? Number(row.admin_earnings) : amount * 0.2;
  return { amount, drv, adm };
}
function statusIsReversed(row) {
  const s = String(row?.status || '').toLowerCase().trim();
  return s === 'reversed';
}

/* Robust local-date parser:
   - If 'YYYY-MM-DD', treat as LOCAL midnight (avoids UTC shift surprises).
   - Else rely on Date(...) */
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
/** mode:
 *  - 'iso' : compare earning_date with ISO timestamps (timestamptz)
 *  - 'ymd' : compare as plain 'YYYY-MM-DD' strings (date/text)
 */
async function fetchEarningsRowsFromSupabase(driverId, filters = {}, mode = 'iso') {
  let q = supabase
    .from('earnings')
    .select('id, amount, total_amount, driver_earnings, admin_earnings, status, package_name, earning_date, driver_id');

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

  const out = rows.map((r) => {
    const { amount, drv, adm } = parseAmountLike(r);
    totalRevenue += amount;
    totalDriver += drv;
    totalAdmin += adm;
    return {
      id: r.id,
      package_name: r.package_name,
      earning_date: r.earning_date,
      status: r.status,
      total_amount: amount,
      driver_earnings: drv,
      admin_earnings: adm,
    };
  });

  return {
    earnings: out,
    statistics: {
      total_revenue: totalRevenue,
      total_driver_earnings: totalDriver,
      total_admin_earnings: totalAdmin,
      admin_percentage: 20,
      driver_percentage: 80,
      count: out.length,
    },
  };
}

/* ------------------------------ Fallbacks --------------------------------- */
async function computeFromSupabaseRobust(driverId, filters = {}) {
  // 1) Try with ISO timestamps
  const isoRows = await fetchEarningsRowsFromSupabase(driverId, filters, 'iso');
  if (isoRows.length > 0) {
    log('Using Supabase ISO rows');
    return { success: true, data: aggregateEarnings(isoRows) };
  }

  // 2) Try with YMD strings
  const ymdRows = await fetchEarningsRowsFromSupabase(driverId, filters, 'ymd');
  if (ymdRows.length > 0) {
    log('Using Supabase YMD rows');
    return { success: true, data: aggregateEarnings(ymdRows) };
  }

  // 3) Fallback to backend aggregated rollup
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

  // 4) Nothing found
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
    // Try API first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const qs = new URLSearchParams();
    if (driverId !== undefined && driverId !== null && driverId !== '') {
      qs.append('driver_id', driverId);
    }
    Object.keys(filters).forEach((k) => {
      const v = filters[k];
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });

    const url = `${EARNINGS_API_BASE_URL}tour_package_earnings/?${qs.toString()}`;
    const token = await getAccessToken().catch(() => null);

    log('Calling API:', url);
    const resp = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      const stats = data?.data?.statistics || {};
      const hadData =
        (Array.isArray(data?.data?.earnings) && data.data.earnings.length > 0) ||
        Number(stats?.total_driver_earnings || 0) > 0 ||
        Number(stats?.count || 0) > 0;

      log('API stats:', { count: stats?.count, total_driver_earnings: stats?.total_driver_earnings, hadData });

      if (data?.success && hadData) return data;
      // API returned minimal/empty → use robust fallback
      return await computeFromSupabaseRobust(driverId, filters);
    }

    log('API non-OK, status:', resp.status);
    return await computeFromSupabaseRobust(driverId, filters);
  } catch (err) {
    log('API error, falling back:', err?.message || err);
    return await computeFromSupabaseRobust(driverId, filters);
  }
}

/**
 * Aggregate stats for the selected period (today/week/month/all)
 * This version computes "today" using a local time window and counts ANY non-reversed rows.
 */
export async function getDriverEarningsStats(driverId, period = 'month') {
  const filters = {};
  const now = new Date();

  let period_from = null;
  let period_to = null;

  switch (period) {
    case 'today': {
      const today = toLocalYMD(now);
      filters.date_from = today; // inclusive
      // no date_to → open upper bound
      period_from = today;
      period_to = today;
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

  const earningsData = await getDriverEarnings(driverId, filters);
  log('Stats raw:', earningsData);

  if (earningsData.success && earningsData.data) {
    const stats = earningsData.data.statistics || {};
    const earnings = Array.isArray(earningsData.data.earnings) ? earningsData.data.earnings : [];

    // Build local "today" window [00:00, next 00:00)
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // Count ANY non-reversed earning that falls inside today's local window
    const todayRows = earnings.filter((e) => {
      const s = String(e?.status || '').toLowerCase();
      if (s === 'reversed') return false;
      const dt = parseDateSafely(e?.earning_date);
      return dt && dt >= start && dt < end;
    });

    // Sum driver share with sensible fallbacks
    const earnings_today = todayRows.reduce((sum, e) => {
      const base = Number(e?.total_amount ?? e?.amount ?? 0);
      const drv = e?.driver_earnings != null ? Number(e.driver_earnings) : base * 0.8;
      return sum + (Number.isFinite(drv) ? drv : 0);
    }, 0);

    const result = {
      ...stats,
      period,
      period_from,
      period_to,
      earnings_today,
      completed_bookings_today: todayRows.length,
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
 * Month/Week % change (uses same robust path)
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

/**
 * Pending payout amount (admin payouts list, filtered for this driver)
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

    const rows = await resp.json();
    const mine = (Array.isArray(rows) ? rows : []).filter(
      (p) => String(p?.driver_id || '') === String(driverId) && String(p?.status || '').toLowerCase() === 'pending'
    );

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

export const _dateHelpers = {
  toLocalYMD,
  addDays,
  startOfWeekMonday,
  endOfWeekExclusive,
  previousWeekExclusiveRange,
  startOfMonth,
  startOfNextMonth,
};

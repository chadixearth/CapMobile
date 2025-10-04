// screens/DriverBreakevenScreen.js
import React, { useMemo, useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { colors, spacing, card } from '../../styles/global';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';

import { getDriverEarningsStats } from '../../services/Earnings/EarningsService';

import {
  getBreakeven,
  getBreakevenHistory,
  upsertBreakevenHistoryFromSummary,
  setBreakevenExpenseCache,
  getTodayExpenses,
  getBreakevenExpenseCache,
  getExpensesSumInRange,
} from '../../services/Earnings/BreakevenService';

const PERIOD_BY_FREQ = {
  Daily: 'today',
  Weekly: 'week',
  Monthly: 'month',
};

// ---------- helpers & constants ----------
const PH_TZ = 'Asia/Manila';
const BUCKET_TZ = 'ph';
const DISPLAY_TZ = 'ph';
const PERIOD_LABEL_TZ = PH_TZ;

// 🔐 Explicit status policies (fixes Monthly/Weekly counts)
const STATUS_IN_DAILY = ['finalized', 'posted', 'completed', 'pending'].join(',');
const STATUS_IN_AGG   = ['finalized', 'posted', 'completed'].join(',');

function formatPeso(n) {
  const num = Number(n || 0);
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toShortDate(iso, timeZone = PH_TZ) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
function periodLabel(startIso, endIso, timeZone = PH_TZ) {
  if (!startIso && !endIso) return '—';
  const s = toShortDate(startIso, timeZone);
  const e = toShortDate(endIso, timeZone);
  return s === e ? s : `${s} — ${e}`;
}
function clamp01(x) {
  if (!isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function statusMeta({ breakeven_hit, profitable }) {
  if (breakeven_hit && profitable) {
    return { label: 'Breakeven + Profit', icon: 'trophy-variant', bg: '#E8F5E9', fg: '#1B5E20' };
  }
  if (breakeven_hit && !profitable) {
    return { label: 'Breakeven, No Profit', icon: 'checkbox-marked-circle-outline', bg: '#FFF7E6', fg: '#8B6B1F' };
  }
  return { label: 'Below Breakeven', icon: 'close-circle-outline', bg: '#FDECEA', fg: '#B3261E' };
}

// ----- local persistence keys & TTL (24h) -----
const TTL_MS = 24 * 60 * 60 * 1000;
const EXPENSES_INPUT_KEY = (driverId, periodKey) =>
  `earnings:expensesInput:v1:${driverId || 'unknown'}:${periodKey || 'today'}`;
const EXPENSES_META_KEY = (driverId, periodKey) =>
  `earnings:expensesMeta:v1:${driverId || 'unknown'}:${periodKey || 'today'}`;

// TODAY (PH) FALLBACK: direct Supabase query when period=Daily
const PH_OFFSET_HOURS = 8;

/** Returns [gteISO, ltISO] bounding *today* (Asia/Manila) expressed in UTC ISO. */
function getPhTodayUtcWindow() {
  const nowUtcMs = Date.now();
  const nowPh = new Date(nowUtcMs + PH_OFFSET_HOURS * 3600_000);
  const y = nowPh.getUTCFullYear();
  const m = nowPh.getUTCMonth();
  const d = nowPh.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - PH_OFFSET_HOURS * 3600_000;
  const endUtcMs   = Date.UTC(y, m, d + 1, 0, 0, 0) - PH_OFFSET_HOURS * 3600_000;
  return [new Date(startUtcMs).toISOString(), new Date(endUtcMs).toISOString()];
}

// Week/month PH windows → UTC ISO (half-open)
function getPhWeekUtcWindow() {
  const now = new Date();
  const nowPh = new Date(now.getTime() + PH_OFFSET_HOURS * 3600_000);
  const d = new Date(Date.UTC(nowPh.getUTCFullYear(), nowPh.getUTCMonth(), nowPh.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday start
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - dow);
  const nextMon = new Date(mon); nextMon.setUTCDate(mon.getUTCDate() + 7);
  const startUtc = new Date(mon.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  const endUtc   = new Date(nextMon.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  return [startUtc, endUtc];
}
function getPhMonthUtcWindow() {
  const now = new Date();
  const nowPh = new Date(now.getTime() + PH_OFFSET_HOURS * 3600_000);
  const y = nowPh.getUTCFullYear();
  const m = nowPh.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const nextFirst = new Date(Date.UTC(y, m + 1, 1));
  const startUtc = new Date(first.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  const endUtc   = new Date(nextFirst.getTime() - PH_OFFSET_HOURS * 3600_000).toISOString();
  return [startUtc, endUtc];
}

// -------- NEW: ms until next PH midnight (00:00 Asia/Manila) --------
function getMsUntilNextPhMidnight() {
  const now = new Date();
  const nowPh = new Date(now.getTime() + PH_OFFSET_HOURS * 3600_000); // shift to PH local
  const y = nowPh.getUTCFullYear();
  const m = nowPh.getUTCMonth();
  const d = nowPh.getUTCDate();
  // next PH midnight, then convert back to UTC ms baseline
  const nextPhMidnightUTCms = Date.UTC(y, m, d + 1, 0, 0, 0) - PH_OFFSET_HOURS * 3600_000;
  const ms = nextPhMidnightUTCms - now.getTime();
  return Math.max(ms, 0);
}

// Driver shares (used in local fallback)
const BOOKING_SHARE = 0.80;
const CUSTOM_SHARE  = 1.00;

/** Direct “income today” fallback by driver, counting in-progress statuses. */
async function fetchIncomeTodayByDriver(driverId, {
  statuses = ['finalized', 'posted', 'completed', 'pending']
} = {}) {
  if (!driverId) return { revenue: 0, count: 0, window: null };
  const [gteISO, ltISO] = getPhTodayUtcWindow();

  let q = supabase
    .from('earnings')
    .select('amount, status, booking_id, custom_tour_id, earning_date')
    .eq('driver_id', driverId)
    .gte('earning_date', gteISO)
    .lt('earning_date', ltISO);

  if (statuses?.length) q = q.in('status', statuses);

  const { data: rows, error } = await q;
  if (error) throw error;

  let revenue = 0;
  let count = 0;
  for (const r of rows || []) {
    const amt = Math.max(Number(r?.amount) || 0, 0);
    if (r.booking_id) revenue += amt * BOOKING_SHARE;
    else if (r.custom_tour_id) revenue += amt * CUSTOM_SHARE;
    count += 1;
  }

  return {
    revenue: Number(revenue.toFixed(2)),
    count,
    window: { gteISO, ltISO },
  };
}



// Resolve driverId
function useDriverId(route) {
  const [id, setId] = React.useState(route?.params?.driverId || null);
  useEffect(() => {
    (async () => {
      if (route?.params?.driverId && route.params.driverId !== id) {
        setId(route.params.driverId);
        return;
      }
      if (id) return;
      try {
        const current = await getCurrentUser().catch(() => null);
        if (current?.id) {
          setId(current.id);
          return;
        }
      } catch {}
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) setId(data.user.id);
      } catch {}
    })();
  }, [id, route?.params?.driverId]);
  return id;
}

export default function EarningsScreen({ navigation, route }) {
  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerShown: false });
  }, [navigation]);

  const driverId = useDriverId(route);

  const latestReqRef = useRef(0);

  // UI
  const [frequency, setFrequency] = useState('Daily'); // Daily | Weekly | Monthly
  const [freqOpen, setFreqOpen] = useState(false);

  // Expenses
  const [expenseInput, setExpenseInput] = useState('0.00');
  const [expenseItems, setExpenseItems] = useState([]); // session-only adds
  const [dbExpensesBase, setDbExpensesBase] = useState(0); // base from DB

  // Breakeven state
  const [farePerRide, setFarePerRide] = useState(0);
  const [bookingsNeeded, setBookingsNeeded] = useState(0);
  const [acceptedBookings, setAcceptedBookings] = useState(0);
  const [revenuePeriod, setRevenuePeriod] = useState(0);
  const [deficitAmount, setDeficitAmount] = useState(0);
  const [periodStart, setPeriodStart] = useState(null);
  const [periodEnd, setPeriodEnd] = useState(null);
  const [shareStandard, setShareStandard] = useState(0);
  const [shareCustom, setShareCustom] = useState(0);

  // Other
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [pendingPayoutAmount, setPendingPayoutAmount] = useState(0);

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyMode, setHistoryMode] = useState('list');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);

  // TODAY fallback
  const [incomeToday, setIncomeToday] = useState(0);

  const periodKey = PERIOD_BY_FREQ[frequency];

  // --------- Reset helper to avoid stale values across filters ---------
  function resetBreakevenState() {
    setFarePerRide(0);
    setBookingsNeeded(0);
    setAcceptedBookings(0);
    setRevenuePeriod(0);
    setDeficitAmount(0);
    setPeriodStart(null);
    setPeriodEnd(null);
    setShareStandard(0);
    setShareCustom(0);
    setIncomeToday(0);
  }

  // ---------- TTL helpers ----------
  const markExpensesTouched = useCallback(async () => {
    if (!driverId) return;
    try {
      await AsyncStorage.setItem(
        EXPENSES_META_KEY(driverId, periodKey),
        JSON.stringify({ updatedAt: Date.now() })
      );
    } catch {}
  }, [driverId, periodKey]);

  const checkAndExpireIfNeeded = useCallback(async () => {
    if (!driverId) return;
    try {
      const rawMeta = await AsyncStorage.getItem(EXPENSES_META_KEY(driverId, periodKey));
      if (!rawMeta) return;
      const meta = JSON.parse(rawMeta);
      const ts = Number(meta?.updatedAt || 0);
      if (ts && Date.now() - ts > TTL_MS) {
        setExpenseItems([]);
        await AsyncStorage.setItem(
          EXPENSES_META_KEY(driverId, periodKey),
          JSON.stringify({ updatedAt: Date.now() })
        );
      }
    } catch {}
  }, [driverId, periodKey]);

  // ---------- load base expenses and last input ----------
  useEffect(() => {
    if (!driverId) return;
    const loadBase = async () => {
      try {
        await checkAndExpireIfNeeded();

        // Determine base DB expenses by period
        let baseExp = 0;

        if (periodKey === 'today') {
          // Daily: use max(today's breakeven_history, cache)
          const [today, cache] = await Promise.all([
            getTodayExpenses(driverId).catch(() => ({ success: false })),
            getBreakevenExpenseCache(driverId).catch(() => ({ success: false })),
          ]);
          const histNum  = (today?.success ? Number(today.expenses || 0) : null);
          const cacheNum = (cache?.success ? Number(cache.expenses || 0) : null);
          if (histNum != null && cacheNum != null) baseExp = Math.max(histNum, cacheNum);
          else if (histNum != null) baseExp = histNum;
          else if (cacheNum != null) baseExp = cacheNum;
        } else if (periodKey === 'week') {
          const [startUtc, endUtc] = getPhWeekUtcWindow();
          const r = await getExpensesSumInRange(driverId, startUtc, endUtc);
          baseExp = r?.success ? Number(r.expenses || 0) : 0;
        } else if (periodKey === 'month') {
          const [startUtc, endUtc] = getPhMonthUtcWindow();
          const r = await getExpensesSumInRange(driverId, startUtc, endUtc);
          baseExp = r?.success ? Number(r.expenses || 0) : 0;
        }

        setDbExpensesBase(Number(baseExp || 0));
        setExpenseItems([]);

        const rawInput = await AsyncStorage.getItem(EXPENSES_INPUT_KEY(driverId, periodKey));
        setExpenseInput(rawInput != null ? String(rawInput) : '0.00');

        const rawMeta = await AsyncStorage.getItem(EXPENSES_META_KEY(driverId, periodKey));
        if (!rawMeta) {
          await AsyncStorage.setItem(
            EXPENSES_META_KEY(driverId, periodKey),
            JSON.stringify({ updatedAt: Date.now() })
          );
        }
      } catch {
        setDbExpensesBase(0);
        setExpenseItems([]);
        setExpenseInput('0.00');
      }
    };
    loadBase();
  }, [driverId, periodKey, checkAndExpireIfNeeded]);

  // Periodic TTL watcher
  useEffect(() => {
    if (!driverId) return;
    const id = setInterval(() => {
      checkAndExpireIfNeeded();
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, periodKey, checkAndExpireIfNeeded]);

  // Persist input on change
  useEffect(() => {
    if (!driverId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EXPENSES_INPUT_KEY(driverId, periodKey), String(expenseInput ?? ''));
      } catch {}
    })();
  }, [driverId, periodKey, expenseInput]);

  // -------- NEW: Reset DAILY expenses at PH midnight --------
  useEffect(() => {
    if (!driverId) return;
    let timeoutId;

    async function handleMidnight() {
      // Only reset if Daily is active; weekly/monthly shouldn't zero at midnight
      if (periodKey === 'today') {
        try { await setBreakevenExpenseCache(driverId, 0); } catch {}

        setExpenseItems([]);
        setExpenseInput('0.00');
        setDbExpensesBase(0);

        try {
          await AsyncStorage.removeItem(EXPENSES_INPUT_KEY(driverId, 'today'));
          await AsyncStorage.setItem(
            EXPENSES_META_KEY(driverId, 'today'),
            JSON.stringify({ updatedAt: Date.now() })
          );
        } catch {}

        // Refresh tiles/summary with the new daily window
        fetchAll(driverId, 'Daily');
      }
      // schedule the next midnight (24h)
      timeoutId = setTimeout(handleMidnight, 24 * 60 * 60 * 1000);
    }

    const firstDelay = getMsUntilNextPhMidnight();
    timeoutId = setTimeout(handleMidnight, firstDelay);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [driverId, periodKey]); // fetchAll is stable enough; avoids rescheduling too often

  // Total expenses = DB base + session adds
  const totalExpenses = useMemo(
    () => (Number(dbExpensesBase || 0) + expenseItems.reduce((sum, n) => sum + (Number(n) || 0), 0)),
    [dbExpensesBase, expenseItems]
  );

  // Add expense
  const addExpense = async () => {
    const val = parseFloat(String(expenseInput).replace(/,/g, '')) || 0;
    if (val <= 0) return;

    if (periodKey === 'today') {
      const sessionAdds = expenseItems.reduce((s, n) => s + (Number(n) || 0), 0);
      const newDbTotal = Math.max(0, Number(dbExpensesBase || 0) + sessionAdds + val);
      const result = await setBreakevenExpenseCache(driverId, newDbTotal);
      console.log('Saved expenses to DB (daily additive):', newDbTotal, result);
      setDbExpensesBase(newDbTotal);
      setExpenseItems([]);
    } else {
      setExpenseItems((prev) => [...prev, val]);
    }

    setExpenseInput('0.00');
    await markExpensesTouched();
  };

  const clearExpenses = () => {
    setExpenseItems([]);
    setExpenseInput('0.00');
  };

  // Breakeven summary loader — write fresh values (no "keep prev" behavior)
  const fetchBreakevenBlock = useCallback(
    async (drvId, period, expensesNumber, freq) => {
      const reqId = ++latestReqRef.current;

      const res = await getBreakeven({
        driverId: drvId,
        period,
        expenses: expensesNumber,
        bucketTz: BUCKET_TZ,
        displayTz: DISPLAY_TZ,
        statusIn: freq === 'Daily' ? STATUS_IN_DAILY : STATUS_IN_AGG,
        debug: __DEV__ ? 1 : 0,
      });

      if (reqId !== latestReqRef.current) return null;

      if (res?.success && res?.data) {
        const d = res.data;

        // Always update the date window
        setPeriodStart(d.date_start || null);
        setPeriodEnd(d.date_end || null);

        // Normalize: empty → zeros
        const fare  = Number(d.fare_per_ride || 0);
        const need  = Number(d.bookings_needed || 0);
        const done  = Number(d.total_bookings || 0);
        const rev   = Number(d.revenue_period || 0);

        setFarePerRide(fare);
        setBookingsNeeded(need);
        setAcceptedBookings(done);
        setRevenuePeriod(rev);

        const ex = Number(expensesNumber || 0);
        const rp = rev;
        const localDeficit = Math.max(ex - rp, 0);

        setDeficitAmount(localDeficit);

        const br = d.breakdown || {};
        setShareStandard(Number(br.driver_share_from_standard || 0));
        setShareCustom(Number(br.driver_share_from_custom || 0));

        return d;
      }

      // Unsuccessful → hard clear this period’s numbers
      setPeriodStart(null);
      setPeriodEnd(null);
      setFarePerRide(0);
      setBookingsNeeded(0);
      setAcceptedBookings(0);
      setRevenuePeriod(0);
      setDeficitAmount(0);
      setShareStandard(0);
      setShareCustom(0);
      return null;
    },
    []
  );

  // Align WEEKLY & MONTHLY revenue via EarningsService
  const fetchAll = useCallback(
    async (drvId, currentFrequency) => {
      if (!drvId) return;
      setErrorText('');
      setLoading(true);

      try {
        const period = PERIOD_BY_FREQ[currentFrequency];

        // Load base expenses by period
        let baseExp = 0;
        if (period === 'today') {
          const [today, cache] = await Promise.all([
            getTodayExpenses(drvId).catch(() => ({ success: false })),
            getBreakevenExpenseCache(drvId).catch(() => ({ success: false })),
          ]);
          const histNum  = (today?.success ? Number(today.expenses || 0) : null);
          const cacheNum = (cache?.success ? Number(cache.expenses || 0) : null);
          if (histNum != null && cacheNum != null) baseExp = Math.max(histNum, cacheNum);
          else if (histNum != null) baseExp = histNum;
          else if (cacheNum != null) baseExp = cacheNum;
        } else if (period === 'week') {
          const [s, e] = getPhWeekUtcWindow();
          const r = await getExpensesSumInRange(drvId, s, e);
          baseExp = r?.success ? Number(r.expenses || 0) : 0;
        } else if (period === 'month') {
          const [s, e] = getPhMonthUtcWindow();
          const r = await getExpensesSumInRange(drvId, s, e);
          baseExp = r?.success ? Number(r.expenses || 0) : 0;
        }
        setDbExpensesBase(Number(baseExp || 0));
        setExpenseItems([]);

        // 1) Earnings stats (align with DriverEarningsScreen)
        const statsRes = await getDriverEarningsStats(drvId, period);
        const baseData = statsRes?.success ? statsRes.data : null;
        setStats(baseData || null);

        // 2) Breakeven (with correct statuses per period)
        const summary = await fetchBreakevenBlock(drvId, period, baseExp, currentFrequency);

        // 3) For WEEKLY and MONTHLY, override revenue using EarningsService
        if ((currentFrequency === 'Weekly' || currentFrequency === 'Monthly') && baseData) {
          setRevenuePeriod(Number(baseData.total_driver_earnings || 0));
          setAcceptedBookings(Number(baseData.count || 0));
          if (baseData.period_from && baseData.period_to) {
            const startIso = new Date(baseData.period_from + 'T00:00:00').toISOString();
            const endIso = new Date(baseData.period_to + 'T23:59:59').toISOString();
            setPeriodStart(startIso);
            setPeriodEnd(endIso);
          }
        }

        // DAILY: keep today’s history updated
        if (currentFrequency === 'Daily' && summary && baseExp > 0) {
          await upsertBreakevenHistoryFromSummary({
            driverId: drvId,
            summary,
            expenses: baseExp,
            periodType: 'daily',
          });
        }

        // Daily direct fallback
        if (currentFrequency === 'Daily') {
          try {
            const r = await fetchIncomeTodayByDriver(drvId);
            setIncomeToday(r.revenue || 0);
          } catch {
            setIncomeToday(0);
          }
        } else {
          setIncomeToday(0);
        }
      } catch (e) {
        setErrorText((e && (e.message || e.toString())) || 'Failed to load earnings. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [fetchBreakevenBlock]
  );

  // Quick visual reset before each fetch on frequency change
  useEffect(() => {
    resetBreakevenState();
    fetchAll(driverId, frequency);
  }, [driverId, frequency, fetchAll]);

  // Recompute & (daily) upsert when expenses change
  useEffect(() => {
    if (!driverId) return;
    const handler = setTimeout(async () => {
      const t = Number(totalExpenses || 0);
      const d = await fetchBreakevenBlock(driverId, periodKey, t, frequency);

      // Keep WEEKLY/MONTHLY revenue aligned with EarningsService after expenses change
      if (frequency === 'Weekly' || frequency === 'Monthly') {
        const res = await getDriverEarningsStats(driverId, PERIOD_BY_FREQ[frequency]);
        if (res?.success && res.data) {
          setRevenuePeriod(Number(res.data.total_driver_earnings || 0));
          setAcceptedBookings(Number(res.data.count || 0));
          if (res.data.period_from && res.data.period_to) {
            const startIso = new Date(res.data.period_from + 'T00:00:00').toISOString();
            const endIso = new Date(res.data.period_to + 'T23:59:59').toISOString();
            setPeriodStart(startIso);
            setPeriodEnd(endIso);
          }
        }
      }

      if (frequency === 'Daily' && d && t > 0) {
        await upsertBreakevenHistoryFromSummary({
          driverId,
          summary: d,
          expenses: t,
          periodType: 'daily',
        });
      }
      if (frequency === 'Daily') {
        fetchIncomeTodayByDriver(driverId).then(
          (r) => setIncomeToday(r?.revenue || 0),
          () => {}
        );
      }
    }, 200);
    return () => clearTimeout(handler);
  }, [driverId, periodKey, totalExpenses, fetchBreakevenBlock, frequency]);

  // Light polling while on Daily
  useEffect(() => {
    if (!driverId || frequency !== 'Daily') return;
    const id = setInterval(() => {
      fetchAll(driverId, 'Daily');
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, frequency, fetchAll]);

  const onRefresh = useCallback(async () => {
    if (!driverId) return;
    setRefreshing(true);
    await fetchAll(driverId, frequency);
    setRefreshing(false);
  }, [driverId, frequency, fetchAll]);

  // History (kept)
  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryMode('list');
    setSelectedHistory(null);
    setHistoryError('');
    setHistoryLoading(true);
    setHistoryPage(0);

    // Get date filters based on current frequency
    let dateFrom, dateTo;
    if (frequency === 'Weekly') {
      const [s, e] = getPhWeekUtcWindow();
      dateFrom = s.split('T')[0];
      dateTo = e.split('T')[0];
    } else if (frequency === 'Monthly') {
      const [s, e] = getPhMonthUtcWindow();
      dateFrom = s.split('T')[0];
      dateTo = e.split('T')[0];
    }

    try {
      const res = await getBreakevenHistory({
        driverId,
        periodType: 'daily',
        limit: 5,
        excludeCurrent: true,
        dateFrom,
        dateTo,
      });

      const items = (res?.success && res?.data?.items) ? res.data.items : [];
      setHistoryItems(items || []);
      setHasMoreHistory(items.length === 5);
    } catch (e) {
      setHistoryError(e?.message || 'Failed to load history.');
      setHistoryItems([]);
      setHasMoreHistory(false);
    } finally {
      setHistoryLoading(false);
    }
  }, [driverId]);

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading || !hasMoreHistory) return;

    setHistoryLoading(true);
    const nextPage = historyPage + 1;

    // Get date filters based on current frequency
    let dateFrom, dateTo;
    if (frequency === 'Weekly') {
      const [s, e] = getPhWeekUtcWindow();
      dateFrom = s.split('T')[0];
      dateTo = e.split('T')[0];
    } else if (frequency === 'Monthly') {
      const [s, e] = getPhMonthUtcWindow();
      dateFrom = s.split('T')[0];
      dateTo = e.split('T')[0];
    }

    try {
      const res = await getBreakevenHistory({
        driverId,
        periodType: 'daily',
        limit: 5,
        excludeCurrent: true,
        offset: nextPage * 5,
        dateFrom,
        dateTo,
      });

      const newItems = (res?.success && res?.data?.items) ? res.data.items : [];
      setHistoryItems(prev => [...prev, ...newItems]);
      setHistoryPage(nextPage);
      setHasMoreHistory(newItems.length === 5);
    } catch (e) {
      setHistoryError(e?.message || 'Failed to load more history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [driverId, historyPage, historyLoading, hasMoreHistory]);

  const closeHistory = () => {
    setHistoryOpen(false);
    setSelectedHistory(null);
    setHistoryMode('list');
    setHistoryPage(0);
    setHasMoreHistory(false);
  };

  const onPickHistory = (h) => {
    setSelectedHistory(h);
    setHistoryMode('detail');
  };

  // Profit for the tile
  const currentProfit = useMemo(
    () => (revenuePeriod || 0) - (totalExpenses || 0),
    [revenuePeriod, totalExpenses]
  );

  const ridesToProfit = useMemo(() => {
    if ((revenuePeriod || 0) > (totalExpenses || 0)) return 0;
    const denom = (farePerRide && farePerRide > 0) ? farePerRide : 1;
    const shortfallPlusEpsilon = Math.max((totalExpenses || 0) - (revenuePeriod || 0) + 0.01, 0);
    return Math.max(1, Math.ceil(shortfallPlusEpsilon / denom));
  }, [revenuePeriod, totalExpenses, farePerRide]);

  const ridesProgress = useMemo(() => {
    if (!bookingsNeeded || bookingsNeeded <= 0) return 0;
    return clamp01((acceptedBookings || 0) / bookingsNeeded);
  }, [bookingsNeeded, acceptedBookings]);

  const safetyMarginPct = useMemo(() => {
    if (!(currentProfit > 0) || !totalExpenses) return null;
    return (currentProfit / totalExpenses) * 100;
  }, [currentProfit, totalExpenses]);

  // Revenue tile number (Daily uses fallback if needed)
  const revenueForTile = useMemo(() => {
    if (frequency === 'Daily') {
      const r = Number(revenuePeriod || 0);
      if (r > 0) return r;
      const f = Number(incomeToday || 0);
      return f > 0 ? f : r;
    }
    return Number(revenuePeriod || 0);
  }, [frequency, revenuePeriod, incomeToday]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Error banner */}
        {!!errorText && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#B3261E" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        )}

        {/* Info / loading */}
        {loading && (
          <View style={[card, styles.elevatedCard, { alignItems: 'center' }]}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 12 }}>
              Loading earnings for breakeven…
            </Text>
          </View>
        )}

        {/* Section header (dropdown only) */}
        <View style={styles.sectionRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calculator-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Break Even Calculator</Text>
          </View>

          <View style={styles.dropdownWrap}>
            <TouchableOpacity
              style={styles.frequencyBtn}
              onPress={() => setFreqOpen((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.frequencyText}>{frequency}</Text>
              <Ionicons
                name={freqOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primary}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>

            {freqOpen && (
              <View style={styles.dropdown}>
                {['Daily', 'Weekly', 'Monthly'].map((opt) => {
                  const active = opt === frequency;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                      onPress={() => {
                        if (opt !== frequency) {
                          resetBreakevenState();   // clear all period values
                          setExpenseItems([]);     // reset session adds
                          setExpenseInput('0.00'); // reset input
                        }
                        setFrequency(opt);
                        setFreqOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownText, active && styles.dropdownTextActive]} numberOfLines={1}>
                        {opt}
                      </Text>
                      {active && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Inputs Card */}
        <View style={[card, styles.elevatedCard]}>
          {/* EXPENSES with Add button */}
          <Text style={styles.inputLabel}>Input Expenses</Text>
          <View style={[styles.inputWrap, { paddingRight: 6 }]}>
            <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={styles.input}
              value={expenseInput}
              onChangeText={setExpenseInput}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity onPress={addExpense} style={styles.btnAdd} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.btnAddText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Small summary row */}
          <View style={styles.expenseSummaryRow}>
            <Text style={styles.expenseSummaryText}>
              Session-added: <Text style={{ fontWeight: '800' }}>{expenseItems.length}</Text> {expenseItems.length === 1 ? 'expense' : 'expenses'}
            </Text>
          </View>

          {/* FARE PER RIDE (read-only) */}
          <Text style={styles.inputLabel}>Fare per ride (driver share)</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="timetable" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={[styles.input, { color: '#687076' }]}
              value={(farePerRide || 0).toFixed(2)}
              editable={false}
              selectTextOnFocus={false}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* BOOKINGS NEEDED (read-only) */}
          <Text style={styles.inputLabel}>Bookings you need to complete (auto)</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.input, { paddingLeft: 0, color: '#687076' }]}
              value={String(bookingsNeeded || 0)}
              editable={false}
              selectTextOnFocus={false}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Metric tiles (row 1) */}
          <View style={styles.metricsRow}>
            {/* Total Expenses */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="card-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>Total Expenses</Text>
              </View>
              <Text
                style={styles.metricValue}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatPeso(totalExpenses)}
              </Text>
            </View>

            {/* Revenue (period) */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>Revenue ({frequency.toLowerCase()})</Text>
              </View>
              <Text
                style={styles.metricValue}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatPeso(
                  frequency === 'Daily'
                    ? (revenueForTile)
                    : (revenuePeriod || 0)
                )}
              </Text>
            </View>
          </View>

          {/* Metric tiles (row 2) */}
          <View style={[styles.metricsRow, { marginTop: 10 }]}>
            {/* Completed Bookings */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>Completed Bookings</Text>
              </View>
              <Text
                style={styles.metricValue}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {acceptedBookings || 0}
              </Text>
            </View>

            {/* Profit */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: currentProfit >= 0 ? '#EAF7EE' : '#FDEEEE' },
                  ]}
                >
                  <Ionicons
                    name={currentProfit >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                    size={16}
                    color={currentProfit >= 0 ? '#2E7D32' : '#C62828' }
                  />
                </View>
                <Text style={styles.metricLabel}>Profit</Text>
              </View>
              <Text
                style={[styles.metricValue, { color: currentProfit >= 0 ? colors.text : '#C62828' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatPeso(currentProfit)}
              </Text>
            </View>
          </View>

          {/* Info when no base+session expenses */}
          {(expenseItems.length === 0 && dbExpensesBase <= 0) && (
            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.badgeInfo]}>
                <Ionicons name="information-circle-outline" size={14} color="#0B61A4" />
                <Text style={styles.badgeInfoText}>
                  Please add expenses to calculate for breakeven and profit
                </Text>
              </View>
            </View>
          )}

          {/* Success badges */}
          {totalExpenses > 0 && (currentProfit >= 0 || currentProfit > 0) && (
            <View style={styles.badgeRow}>
              {currentProfit >= 0 && (
                <View style={[styles.badge, styles.badgeSuccess]}>
                  <Ionicons name="checkmark-circle" size={14} color="#1B5E20" />
                  <Text style={styles.badgeSuccessText}>Breakeven hit</Text>
                </View>
              )}

              {currentProfit > 0 && (
                <View style={[styles.badge, styles.badgeSuccess]}>
                  <Ionicons name="cash-outline" size={14} color="#1B5E20" />
                  <Text style={styles.badgeSuccessText}>
                    In profit: ₱ {formatPeso(currentProfit)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* suggestion when exactly breakeven */}
          {totalExpenses > 0 && currentProfit === 0 && (
            <View style={[styles.tipBanner, { backgroundColor: '#FFF7E6', borderColor: '#FCE3BF' }]}>
              <Ionicons name="bulb-outline" size={16} color="#8B6B1F" style={{ marginRight: 8 }} />
              <Text style={[styles.tipText, { color: '#8B6B1F' }]}>
                You’ve hit breakeven. Complete{' '}
                <Text style={{ fontWeight: '800' }}>{ridesToProfit}</Text>{' '}
                or more bookings to start earning profit.
              </Text>
            </View>
          )}

          {/* Guidance banner when still no profit */}
          {totalExpenses > 0 && currentProfit < 0 && (
            <View style={styles.tipBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#0B3D91" style={{ marginRight: 8 }} />
              <Text style={styles.tipText}>
                You have not reached profit yet. Accept about{' '}
                <Text style={{ fontWeight: '800' }}>{bookingsNeeded}</Text> ride(s) in total to cover{' '}
                <Text style={{ fontWeight: '800' }}>
                  ₱ {formatPeso(totalExpenses)}
                </Text>. Current deficit:{' '}
                <Text style={{ fontWeight: '800' }}>
                  ₱ {formatPeso(Math.abs(currentProfit))}
                </Text>.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={clearExpenses} style={styles.btnOutline} activeOpacity={0.85}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Reset (session only)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== Breakeven Summary card ====== */}
        <View style={[card, styles.elevatedCard]}>
          <View style={styles.summaryHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="progress-clock" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Breakeven Summary</Text>
            </View>

            {/* History icon → modal */}
            <TouchableOpacity onPress={openHistory} style={styles.historyBtn} accessibilityLabel="Open breakeven & profit history">
              <MaterialCommunityIcons name="history" size={18} color={colors.primary} />
              <Text style={styles.historyBtnText}>History</Text>
            </TouchableOpacity>
          </View>

          {/* Summary date (formatted in PH timezone) */}
          <View style={styles.summaryDateWrap}>
            <Text style={styles.summaryDateLabel}>Summary date</Text>
            <Text style={styles.summaryDateValue}>{periodLabel(periodStart, periodEnd, PERIOD_LABEL_TZ)}</Text>
          </View>

          <Text style={styles.summaryLine}>
            Breakeven at <Text style={styles.strong}>{bookingsNeeded}</Text> ride(s). You’re at{' '}
            <Text style={styles.strong}>{acceptedBookings}</Text>.
          </Text>

          {/* progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${ridesProgress * 100}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>{Math.round(ridesProgress * 100)}%</Text>
            <Text style={styles.progressMetaText}>({acceptedBookings}/{bookingsNeeded})</Text>
          </View>

          {/* margin/deficit */}
          {currentProfit > 0 ? (
            <View style={[styles.callout, styles.calloutSuccess]}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#1B5E20" style={{ marginRight: 8 }} />
              <Text style={styles.calloutText}>
                Safety margin: <Text style={styles.strong}>{safetyMarginPct ? `${safetyMarginPct.toFixed(1)}%` : '—'}</Text>. Keep it up!
              </Text>
            </View>
          ) :  (
            <View style={[styles.callout, styles.calloutWarn]}>
              <Ionicons name="alert-outline" size={16} color="#8B2C2C" style={{ marginRight: 8 }} />
              <Text style={styles.calloutText}>
                Current deficit: <Text style={styles.strong}>₱ {formatPeso(Math.abs(currentProfit))}</Text>.
              </Text>
            </View>
          )}
        </View>

        {/* ====== Source Mix ====== */}
        <View style={[card, styles.elevatedCard]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="chart-donut" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Revenue Mix (Driver Share)</Text>
          </View>

          <View style={styles.mixRow}>
            <View style={styles.mixLeft}>
              <Text style={styles.mixLabel}>Standard rides (80%)</Text>
              <Text style={styles.mixDesc}>Driver share from bookings</Text>
            </View>
            <Text style={styles.mixValue}>₱ {formatPeso(shareStandard)}</Text>
          </View>

          <View style={[styles.mixRow, styles.feedDivider]}>
            <View style={styles.mixLeft}>
              <Text style={styles.mixLabel}>Custom tours (100%)</Text>
              <Text style={styles.mixDesc}>Driver share from custom</Text>
            </View>
            <Text style={styles.mixValue}>₱ {formatPeso(shareCustom)}</Text>
          </View>

          <View style={[styles.mixRow, { marginTop: 8 }]}>
            <View style={styles.mixLeft}>
              <Text style={[styles.mixLabel, { fontWeight: '800' }]}>Total (period)</Text>
            </View>
            <Text style={[styles.mixValue, { fontWeight: '900' }]}>₱ {formatPeso(revenuePeriod)}</Text>
          </View>
        </View>

        {/* ====== Expense Breakdown ====== */}
        <View style={[card, styles.elevatedCard]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Expenses Breakdown</Text>
          </View>

          {expenseItems.length === 0 ? (
            <Text style={styles.muted}>
              No new expenses added this session.
            </Text>
          ) : (
            <View>
              {expenseItems.map((amt, idx) => (
                <View key={idx} style={[styles.mixRow, idx < expenseItems.length - 1 && styles.feedDivider]}>
                  <View style={styles.mixLeft}>
                    <Text style={styles.mixLabel}>Session Expense #{idx + 1}</Text>
                  </View>
                  <Text style={styles.mixValue}>₱ {formatPeso(amt)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.mixRow, { marginTop: 8 }]}>
            <View style={styles.mixLeft}>
              <Text style={[styles.mixLabel, { fontWeight: '800' }]}>DB Expenses (base)</Text>
              <Text style={styles.mixDesc}>
                Daily: max(today history, cache). Weekly/Monthly: sum of breakeven history in range.
              </Text>
            </View>
            <Text style={[styles.mixValue, { fontWeight: '900' }]}>₱ {formatPeso(dbExpensesBase)}</Text>
          </View>

          <View style={[styles.mixRow]}>
            <View style={styles.mixLeft}>
              <Text style={[styles.mixLabel, { fontWeight: '800' }]}>Total Expenses (used)</Text>
              <Text style={styles.mixDesc}>DB base + this session</Text>
            </View>
            <Text style={[styles.mixValue, { fontWeight: '900' }]}>₱ {formatPeso(totalExpenses)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ==================== HISTORY MODAL ==================== */}
      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={closeHistory}>
        <Pressable style={styles.modalBackdrop} onPress={closeHistory} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            {historyMode === 'list' ? (
              <>
                <Text style={styles.modalTitle}>Breakeven & Profit History</Text>
                <TouchableOpacity onPress={closeHistory} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setHistoryMode('list')} style={styles.modalBack}>
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                  <Text style={styles.modalBackText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={closeHistory} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {historyMode === 'list' && (
            <View style={{ maxHeight: 420 }}>
              {historyLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 12 }}>Loading history…</Text>
                </View>
              ) : historyError ? (
                <Text style={[styles.muted, { color: '#B3261E' }]}>{historyError}</Text>
              ) : historyItems.length === 0 ? (
                <Text style={styles.muted}>No history yet.</Text>
              ) : (
                <>
                  {historyItems.map((h, idx) => {
                    const sm = statusMeta(h);
                    return (
                      <TouchableOpacity
                        key={h.id || idx}
                        style={[styles.historyRow, idx < historyItems.length - 1 && styles.feedDivider]}
                        onPress={() => onPickHistory(h)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.historyLeft}>
                          <Text style={styles.historyTitle}>{periodLabel(h.period_start, h.period_end /* PH */)}</Text>
                          <Text style={styles.historySub}>
                            Revenue ₱{formatPeso(h.revenue_driver)} • Expenses ₱{formatPeso(h.expenses)} • Profit ₱{formatPeso(h.profit)}
                          </Text>
                          <Text style={styles.historySubSmall}>
                            Rides {h.rides_done}/{h.rides_needed}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: sm.bg, borderColor: sm.bg }]}>
                          <MaterialCommunityIcons name={sm.icon} size={16} color={sm.fg} />
                          <Text style={[styles.statusPillText, { color: sm.fg }]}>{sm.label}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {hasMoreHistory && (
                    <TouchableOpacity
                      onPress={loadMoreHistory}
                      style={styles.loadMoreBtn}
                      disabled={historyLoading}
                      activeOpacity={0.7}
                    >
                      {historyLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="chevron-down" size={16} color={colors.primary} />
                          <Text style={styles.loadMoreText}>Load More</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {historyMode === 'detail' && selectedHistory && (
            <View style={{ maxHeight: 460 }}>
              <Text style={styles.detailDate}>{periodLabel(selectedHistory.period_start, selectedHistory.period_end /* PH */)}</Text>

              {/* Status */}
              {(() => {
                const sm = statusMeta(selectedHistory);
                return (
                  <View style={[styles.statusPill, { alignSelf: 'flex-start', backgroundColor: sm.bg, borderColor: sm.bg, marginTop: 6 }]}>
                    <MaterialCommunityIcons name={sm.icon} size={16} color={sm.fg} />
                    <Text style={[styles.statusPillText, { color: sm.fg }]}>{sm.label}</Text>
                  </View>
                );
              })()}

              {/* Numbers */}
              <View style={styles.detailGrid}>
                <View className="detailCell" style={styles.detailCell}>
                  <Text style={styles.detailLabel}>Revenue (driver)</Text>
                  <Text style={styles.detailValue}>₱ {formatPeso(selectedHistory.revenue_driver)}</Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>Expenses</Text>
                  <Text style={styles.detailValue}>₱ {formatPeso(selectedHistory.expenses)}</Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>Profit</Text>
                  <Text style={styles.detailValue}>₱ {formatPeso(selectedHistory.profit)}</Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>Rides</Text>
                  <Text style={styles.detailValue}>{selectedHistory.rides_done}/{selectedHistory.rides_needed}</Text>
                </View>
              </View>

              {/* Breakdown */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.detailSectionTitle}>Breakdown</Text>
                <View className="mixRow" style={styles.mixRow}>
                  <Text style={styles.mixLabel}>Standard rides (80%)</Text>
                  <Text style={styles.mixValue}>₱ {formatPeso(selectedHistory?.breakdown?.standard_share || 0)}</Text>
                </View>
                <View style={[styles.mixRow, styles.feedDivider]}>
                  <Text style={styles.mixLabel}>Custom tours (100%)</Text>
                  <Text style={styles.mixValue}>₱ {formatPeso(selectedHistory?.breakdown?.custom_share || 0)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ============================ Styles ============================ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: '#F6C4C0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: { color: '#B3261E', fontWeight: '600', fontSize: 12 },
  tipBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#E9F4FF',
    borderWidth: 1,
    borderColor: '#BBDDFB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: { color: '#0B3D91', fontSize: 12, flex: 1 },
  sectionRow: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  dropdownWrap: { position: 'relative' },
  frequencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#EDEDED',
  },
  frequencyText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  dropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 150,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    paddingVertical: 6,
    zIndex: 10,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemActive: { backgroundColor: '#F7F7F7' },
  dropdownText: { color: colors.text, fontSize: 13 },
  dropdownTextActive: { color: colors.primary, fontWeight: '700' },
  elevatedCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardTight: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 1, marginBottom: 6, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECECEC',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputPrefix: { color: colors.textSecondary, marginRight: 6, fontWeight: '700' },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  btnAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
  },
  btnAddText: { color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 4 },
  expenseSummaryRow: {
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseSummaryText: { color: colors.textSecondary, fontSize: 12 },
  metricsRow: { flexDirection: 'row', marginTop: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1EAE6',
    padding: 12,
    marginRight: 10,
  },
  shadowSoft: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minWidth: 0,
  },
  iconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4ECE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
    minWidth: 0,
    flexShrink: 1,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeInfo: { backgroundColor: '#E9F4FF', borderColor: '#BBDDFB' },
  badgeInfoText: { color: '#0B3D91', fontSize: 12, fontWeight: '800', marginLeft: 6, flexShrink: 1, flexWrap: 'wrap' },
  badgeSuccess: { backgroundColor: '#EAF7EE', borderColor: '#CDEBD1' },
  badgeSuccessText: { color: '#1B5E20', fontSize: 12, fontWeight: '800', marginLeft: 6 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  btnOutlineText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EDEDED',
    backgroundColor: '#fff',
  },
  historyBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  summaryDateWrap: { marginTop: 2, marginBottom: 8 },
  summaryDateLabel: { color: colors.textSecondary, fontSize: 11 },
  summaryDateValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  summaryLine: { color: colors.text, fontSize: 13, marginTop: 2 },
  progressTrack: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#6d2932' },
  progressMeta: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  progressMetaText: { color: colors.textSecondary, fontSize: 12 },
  callout: { marginTop: 12, padding: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  calloutSuccess: { backgroundColor: '#EAF7EE', borderColor: '#CDEBD1' },
  calloutWarn: { backgroundColor: '#FFF4F2', borderColor: '#FAD2CF' },
  calloutText: { color: colors.text, fontSize: 12, flex: 1 },
  strong: { fontWeight: '800' },
  mixRow: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mixLeft: { flexShrink: 1, paddingRight: 12 },
  mixLabel: { color: colors.text, fontWeight: '700', fontSize: 13, flexWrap: 'wrap' },
  mixDesc: { color: colors.textSecondary, fontSize: 11, marginTop: 2, flexWrap: 'wrap' },
  mixValue: { color: colors.text, fontSize: 15, fontWeight: '900' },
  feedDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  muted: { color: colors.textSecondary, fontSize: 12 },
  modalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalCard: {
    marginHorizontal: 20,
    marginTop: 80,
    marginBottom: 30,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EEE6E0',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalClose: { padding: 4 },
  modalBack: { flexDirection: 'row', alignItems: 'center' },
  modalBackText: { color: colors.primary, fontWeight: '700' },
  historyRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLeft: { paddingRight: 12, flex: 1 },
  historyTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  historySub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  historySubSmall: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: { fontWeight: '800', fontSize: 11, marginLeft: 6 },
  detailDate: { color: colors.text, fontWeight: '800', fontSize: 15 },
  detailSectionTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  detailGrid: { marginTop: 12, borderWidth: 1, borderColor: '#EEE6E0', borderRadius: 12, overflow: 'hidden' },
  detailCell: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE6E0' },
  detailLabel: { color: colors.textSecondary, fontSize: 12 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  loadMoreText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
});

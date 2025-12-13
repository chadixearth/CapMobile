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
  Image,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import BreakevenNotificationBadge from '../../components/BreakevenNotificationBadge';
import BreakevenChart from '../../components/BreakevenChart';
import HistoryModal from '../../components/HistoryModal';
import LogoLoader from '../../components/customLoading';
import { colors, spacing, card } from '../../styles/global';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';

import { getDriverEarningsStats } from '../../services/Earnings/EarningsService';
import BreakevenNotificationManager from '../../services/breakeven';
import { exportBreakevenReport } from '../../services/pdfExportService';

import {
  getBreakeven,
  getBreakevenHistory,
  getBreakevenHistoryDirect,
  upsertBreakevenHistoryFromSummary,
  setBreakevenExpenseCache,
  getTodayExpenses,
  getBreakevenExpenseCache,
  getExpensesSumInRange,
  saveExpensesForPeriod,
  getTotalDriverEarnings,
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
const RIDE_HAILING_SHARE = 0.80;

/** Direct “income today” fallback by driver, counting in-progress statuses. */
async function fetchIncomeTodayByDriver(driverId, {
  statuses = ['finalized', 'posted', 'completed', 'pending']
} = {}) {
  if (!driverId) return { revenue: 0, count: 0, window: null };
  const [gteISO, ltISO] = getPhTodayUtcWindow();

  let q = supabase
    .from('earnings')
    .select('driver_earnings, booking_id, custom_tour_id, ride_hailing_booking_id, earning_date')
    .eq('driver_id', driverId)
    .gte('earning_date', gteISO)
    .lt('earning_date', ltISO);

  if (statuses?.length) q = q.in('status', statuses);

  const { data: rows, error } = await q;
  if (error) throw error;

  let revenue = 0;
  let count = 0;
  for (const r of rows || []) {
    const driverEarnings = Number(r?.driver_earnings || 0);
    if (driverEarnings > 0) {
      revenue += driverEarnings;
      count += 1;
    }
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
  const [shareRideHailing, setShareRideHailing] = useState(0);

  // Other
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [pendingPayoutAmount, setPendingPayoutAmount] = useState(0);
  const [exportingPDF, setExportingPDF] = useState(false);

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyMode, setHistoryMode] = useState('list');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);

  // Animation for loading states
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  // TODAY fallback
  const [incomeToday, setIncomeToday] = useState(0);

  const periodKey = PERIOD_BY_FREQ[frequency];

  // Animation effect for loading states
  useEffect(() => {
    if (loading || historyLoading || filterLoading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      
      const createDotAnimation = (animValue, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      const dot1Animation = createDotAnimation(dot1Anim, 0);
      const dot2Animation = createDotAnimation(dot2Anim, 200);
      const dot3Animation = createDotAnimation(dot3Anim, 400);
      
      pulse.start();
      dot1Animation.start();
      dot2Animation.start();
      dot3Animation.start();
      
      return () => {
        pulse.stop();
        dot1Animation.stop();
        dot2Animation.stop();
        dot3Animation.stop();
      };
    }
  }, [loading, historyLoading, filterLoading, pulseAnim, dot1Anim, dot2Anim, dot3Anim]);

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
    setShareRideHailing(0);
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
          // Clear dismissed notifications for new day
          BreakevenNotificationManager.clearBreakevenState(driverId);
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

    try {
      // Calculate new total expenses
      const sessionAdds = expenseItems.reduce((s, n) => s + (Number(n) || 0), 0);
      const newTotal = Number(dbExpensesBase || 0) + sessionAdds + val;
      
      // Get period bounds
      let startUtc, endUtc, periodType;
      if (periodKey === 'today') {
        [startUtc, endUtc] = getPhTodayUtcWindow();
        periodType = 'daily';
        // Also update cache for daily
        await setBreakevenExpenseCache(driverId, newTotal);
      } else if (periodKey === 'week') {
        [startUtc, endUtc] = getPhWeekUtcWindow();
        periodType = 'weekly';
      } else if (periodKey === 'month') {
        [startUtc, endUtc] = getPhMonthUtcWindow();
        periodType = 'monthly';
      }
      
      // Get current breakeven data with the new expense amount
      const breakevenData = await fetchBreakevenBlock(driverId, periodKey, newTotal, frequency);
      
      // Save complete breakeven data to history table
      const saveResult = await saveExpensesForPeriod({
        driverId,
        periodType,
        periodStart: startUtc,
        periodEnd: endUtc,
        expenses: newTotal,
        breakevenData,
      });
      
      if (saveResult.success) {
        console.log('Complete breakeven data saved:', saveResult.data);
        setDbExpensesBase(newTotal);
        setExpenseItems([]);
        setExpenseInput('0.00');
        await markExpensesTouched();
        // Refresh data
        fetchAll(driverId, frequency);
      } else {
        console.error('Failed to save breakeven data:', saveResult.error);
        setErrorText('Failed to save data: ' + saveResult.error);
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      setErrorText('Failed to save expense. Please try again.');
    }
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

        const done = Number(d.total_bookings || 0);
        const rev = Number(d.revenue_period || 0);
        const ex = Number(expensesNumber || 0);

        setAcceptedBookings(done);
        setRevenuePeriod(rev);

        // Calculate fare per ride = revenue / completed bookings
        const farePerRideCalc = done > 0 ? rev / done : 0;
        setFarePerRide(farePerRideCalc);

        // Calculate bookings needed to hit breakeven
        if (rev >= ex) {
          setBookingsNeeded(0); // Already at breakeven
        } else if (farePerRideCalc > 0) {
          const deficit = ex - rev;
          const additionalBookings = Math.ceil(deficit / farePerRideCalc);
          setBookingsNeeded(additionalBookings);
        } else {
          setBookingsNeeded(0);
        }

        const localDeficit = Math.max(ex - rev, 0);
        setDeficitAmount(localDeficit);

        const br = d.breakdown || {};
        setShareStandard(Number(br.driver_share_from_standard || 0));
        setShareRideHailing(Number(br.driver_share_from_ride_hailing || br.driver_share_from_custom || 0));

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
      setShareRideHailing(0);
      return null;
    },
    []
  );

  // Align WEEKLY & MONTHLY revenue via EarningsService
  const fetchAll = useCallback(
    async (drvId, currentFrequency, isFilterChange = false) => {
      if (!drvId) return;
      setErrorText('');
      if (!isFilterChange) {
        setLoading(true);
      }

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

        // 1) Get total earnings including ride hailing
        const earningsRes = await getTotalDriverEarnings(drvId, period);
        const earningsData = earningsRes?.success ? earningsRes.data : null;
        
        // 2) Earnings stats (align with DriverEarningsScreen)
        const statsRes = await getDriverEarningsStats(drvId, period);
        const baseData = statsRes?.success ? statsRes.data : null;
        setStats(baseData || null);

        // 3) Breakeven (only for Daily to avoid intermediate values)
        const summary = currentFrequency === 'Daily' ? await fetchBreakevenBlock(drvId, period, baseExp, currentFrequency) : null;

        // 4) Use total earnings (including ride hailing) for all periods
        if (earningsData) {
          const totalRevenue = Number(earningsData.total_earnings || 0);
          const totalBookings = Number(earningsData.count || 0);
          
          setRevenuePeriod(totalRevenue);
          setAcceptedBookings(totalBookings);
          setShareStandard(Number(earningsData.standard_earnings || 0));
          setShareRideHailing(Number(earningsData.ride_hailing_earnings || 0));
          
          // Use period dates from summary if available, otherwise from stats
          if (summary?.date_start && summary?.date_end) {
            setPeriodStart(summary.date_start);
            setPeriodEnd(summary.date_end);
          } else if (baseData?.period_from && baseData?.period_to) {
            const startIso = new Date(baseData.period_from + 'T00:00:00').toISOString();
            const endIso = new Date(baseData.period_to + 'T23:59:59').toISOString();
            setPeriodStart(startIso);
            setPeriodEnd(endIso);
          }
          
          // Calculate fare per ride = revenue / completed bookings
          const farePerRideCalc = totalBookings > 0 ? totalRevenue / totalBookings : 0;
          setFarePerRide(farePerRideCalc);
          
          // Calculate bookings needed to hit breakeven
          if (totalRevenue >= baseExp) {
            setBookingsNeeded(0); // Already at breakeven
          } else if (farePerRideCalc > 0) {
            const deficit = baseExp - totalRevenue;
            const additionalBookings = Math.ceil(deficit / farePerRideCalc);
            setBookingsNeeded(additionalBookings);
          } else {
            setBookingsNeeded(0);
          }
          
          const deficit = Math.max(baseExp - totalRevenue, 0);
          setDeficitAmount(deficit);
        }

        // DAILY: keep today’s history updated
        if ((currentFrequency === 'Weekly' || currentFrequency === 'Monthly') && earningsData && baseExp >= 0) {
          const periodType = currentFrequency === 'Weekly' ? 'weekly' : 'monthly';
          await saveExpensesForPeriod({
            driverId: drvId,
            periodType,
            periodStart: baseData?.period_from ? new Date(baseData.period_from + 'T00:00:00').toISOString() : new Date().toISOString(),
            periodEnd: baseData?.period_to ? new Date(baseData.period_to + 'T23:59:59').toISOString() : new Date().toISOString(),
            expenses: baseExp,
            breakevenData: {
              revenue_period: earningsData.total_earnings,
              total_bookings: earningsData.count,
              breakdown: {
                driver_share_from_standard: earningsData.standard_earnings,
                driver_share_from_ride_hailing: earningsData.ride_hailing_earnings,
              }
            },
          });
        }

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
        if (!isFilterChange) {
          setLoading(false);
        } else {
          setFilterLoading(false);
        }
      }
    },
    [fetchBreakevenBlock]
  );



  // Load chart data when frequency changes
  const loadChartData = useCallback(async () => {
    if (!driverId) return;
    
    const periodTypeMap = {
      'Daily': 'daily',
      'Weekly': 'weekly',
      'Monthly': 'monthly'
    };
    const periodType = periodTypeMap[frequency] || 'daily';
    
    try {
      const res = await getBreakevenHistoryDirect({
        driverId,
        periodType,
        limit: 10, // Show more data points for chart
        offset: 0,
        excludeCurrent: periodType === 'daily',
      });
      
      const items = (res?.success && res?.data?.items) ? res.data.items : [];
      setHistoryItems(items || []);
    } catch (e) {
      setHistoryItems([]);
    }
  }, [driverId, frequency]);

  // Quick visual reset before each fetch on frequency change
  useEffect(() => {
    resetBreakevenState();
    fetchAll(driverId, frequency, true); // true indicates filter change
    loadChartData(); // Load chart data
  }, [driverId, frequency, fetchAll, loadChartData]);

  // Recompute & (daily) upsert when expenses change
  useEffect(() => {
    if (!driverId) return;
    const handler = setTimeout(async () => {
      const t = Number(totalExpenses || 0);
      const d = frequency === 'Daily' ? await fetchBreakevenBlock(driverId, periodKey, t, frequency) : null;

      // Keep revenue aligned with total earnings (including ride hailing) after expenses change
      const earningsRes = await getTotalDriverEarnings(driverId, periodKey);
      if (earningsRes?.success && earningsRes.data) {
        const totalRevenue = Number(earningsRes.data.total_earnings || 0);
        const totalBookings = Number(earningsRes.data.count || 0);
        
        setRevenuePeriod(totalRevenue);
        setAcceptedBookings(totalBookings);
        setShareStandard(Number(earningsRes.data.standard_earnings || 0));
        setShareRideHailing(Number(earningsRes.data.ride_hailing_earnings || 0));
        
        // Recalculate fare per ride and bookings needed with updated data
        const farePerRideCalc = totalBookings > 0 ? totalRevenue / totalBookings : 0;
        setFarePerRide(farePerRideCalc);
        
        if (totalRevenue >= t) {
          setBookingsNeeded(0);
        } else if (farePerRideCalc > 0) {
          const deficit = t - totalRevenue;
          const additionalBookings = Math.ceil(deficit / farePerRideCalc);
          setBookingsNeeded(additionalBookings);
        } else {
          setBookingsNeeded(0);
        }
        
        const deficit = Math.max(t - totalRevenue, 0);
        setDeficitAmount(deficit);
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

      // Store current breakeven data for scheduled notifications (Daily only)
      if (frequency === 'Daily' && d && t > 0) {
        try {
          const currentData = {
            expenses: t,
            revenue_period: Number(d.revenue_period || 0),
            total_bookings: Number(d.total_bookings || 0),
            bookings_needed: Number(d.bookings_needed || 0),
            timestamp: Date.now()
          };
          
          // Store data for scheduled notifications (no immediate notification)
          await AsyncStorage.setItem(`breakeven_last_${driverId}`, JSON.stringify(currentData));
          
        } catch (error) {
          console.warn('Failed to store breakeven data for notifications:', error);
        }
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


  // Reset expenses BOTH locally and in the DB (for Daily)
  const onResetExpenses = useCallback(async () => {
    if (!driverId) return;
    try {
      if (periodKey === 'today') {
        // 1) Clear the writable cache used by Daily
        await setBreakevenExpenseCache(driverId, 0);
        console.log('[Breakeven] Daily cache reset → 0');

        // 2) Hard-clear today's breakeven_history EXPENSES, PROFIT, and RIDES_NEEDED (PH calendar day)
        const [gteISO, ltISO] = getPhTodayUtcWindow(); // already defined above
        const { error } = await supabase
          .from('breakeven_history')
          .update({ 
            expenses: 0,
            profit: 0,
            rides_needed: 0
          })
          .eq('driver_id', driverId)
          .eq('period_type', 'daily')
          .gte('period_start', gteISO)
          .lt('period_start', ltISO);

        if (error) {
          console.log('[Breakeven] history reset error:', error.message || error);
        } else {
          console.log('[Breakeven] breakeven_history expenses, profit, and rides_needed reset to 0 for today');
        }
      }
    } catch (e) {
      console.log('[Breakeven] Failed to reset DB expenses:', e?.message || e);
    } finally {
      // Local/session clear
      setExpenseItems([]);
      setExpenseInput('0.00');
      setDbExpensesBase(0);

      // Clean local storage keys for the active period
      try {
        await AsyncStorage.removeItem(EXPENSES_INPUT_KEY(driverId, periodKey));
        await AsyncStorage.setItem(
          EXPENSES_META_KEY(driverId, periodKey),
          JSON.stringify({ updatedAt: Date.now() })
        );
      } catch {}

      // Re-fetch so baseExp = max(todayHistory=0, cache=0)
      fetchAll(driverId, frequency);
    }
  }, [driverId, periodKey, frequency, fetchAll]);


  // History (kept)
  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryMode('list');
    setSelectedHistory(null);
    setHistoryError('');
    setHistoryLoading(true);
    setHistoryPage(0);

    // Map frequency to period_type
    const periodTypeMap = {
      'Daily': 'daily',
      'Weekly': 'weekly', 
      'Monthly': 'monthly'
    };
    const periodType = periodTypeMap[frequency] || 'daily';

    try {
      const res = await getBreakevenHistoryDirect({
        driverId,
        periodType,
        limit: 5,
        offset: 0,
        excludeCurrent: periodType === 'daily',
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
  }, [driverId, frequency]);

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading || !hasMoreHistory) return;

    setHistoryLoading(true);
    const nextPage = historyPage + 1;

    // Map frequency to period_type
    const periodTypeMap = {
      'Daily': 'daily',
      'Weekly': 'weekly',
      'Monthly': 'monthly'
    };
    const periodType = periodTypeMap[frequency] || 'daily';

    try {
      const res = await getBreakevenHistoryDirect({
        driverId,
        periodType,
        limit: 5,
        offset: nextPage * 5,
        excludeCurrent: periodType === 'daily',
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
  }, [driverId, frequency, historyPage, historyLoading, hasMoreHistory]);

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

  // Export handler for chart
  const handleChartExportPDF = async () => {
    if (exportingPDF) return;
    
    setExportingPDF(true);
    try {
      const result = await exportBreakevenReport(historyItems, frequency);
      
      if (!result.success) {
        setErrorText('Failed to export report: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      setErrorText('Failed to export report: ' + error.message);
    } finally {
      setExportingPDF(false);
    }
  };

  // Export handler for main screen
  const handleExportPDF = async () => {
    if (exportingPDF) return;
    
    setExportingPDF(true);
    try {
      const result = await exportBreakevenReport(historyItems, frequency);
      
      if (!result.success) {
        setErrorText('Failed to export report: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      setErrorText('Failed to export report: ' + error.message);
    } finally {
      setExportingPDF(false);
    }
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
    const totalNeeded = (acceptedBookings || 0) + (bookingsNeeded || 0);
    if (totalNeeded <= 0) return 0;
    return clamp01((acceptedBookings || 0) / totalNeeded);
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

      <View style={styles.scrollContainer}>
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
              {filterLoading ? (
                <Animated.View style={{ opacity: pulseAnim, marginLeft: 6 }}>
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                </Animated.View>
              ) : (
                <Ionicons
                  name={freqOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                  style={{ marginLeft: 6 }}
                />
              )}
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
                          setFilterLoading(true);  // start filter loading
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
        
        {/* Breakeven notification badge below dropdown */}
        <View style={styles.notificationRow}>
          <BreakevenNotificationBadge driverId={driverId} />
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
                You have not reached profit yet. Accept {' '}
                <Text style={{ fontWeight: '800' }}></Text> ride(s) to cover{' '}
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
            <TouchableOpacity onPress={onResetExpenses} style={styles.btnOutline} activeOpacity={0.85}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Reset expenses</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== Modern Breakeven Summary Card ====== */}
        <View style={[card, styles.elevatedCard, styles.modernCard]}>
          {/* Header */}
          <View style={styles.modernHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.modernIconContainer}>
                <MaterialCommunityIcons name="chart-line" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.modernTitle}>Breakeven Summary</Text>
                <Text style={styles.modernSubtitle}>{periodLabel(periodStart, periodEnd, PERIOD_LABEL_TZ)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={openHistory} style={styles.modernHistoryBtn}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Status Overview */}
          <View style={styles.statusOverview}>
            {(() => {
              const hasData = (acceptedBookings > 0) || (revenuePeriod > 0) || (totalExpenses > 0);
              
              if (!hasData) {
                return (
                  <View style={[styles.modernStatusBadge, { backgroundColor: '#F3F4F6' }]}>
                    <MaterialCommunityIcons name="information-outline" size={18} color="#6B7280" />
                    <Text style={[styles.modernStatusText, { color: '#6B7280' }]}>No Data Available</Text>
                  </View>
                );
              }
              
              const breakevenHit = (revenuePeriod || 0) >= (totalExpenses || 0);
              const profitable = (revenuePeriod || 0) > (totalExpenses || 0);
              const meta = statusMeta({ breakeven_hit: breakevenHit, profitable });
              
              return (
                <View style={[styles.modernStatusBadge, { backgroundColor: meta.bg }]}>
                  <MaterialCommunityIcons name={meta.icon} size={18} color={meta.fg} />
                  <Text style={[styles.modernStatusText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
              );
            })()}
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Breakeven Progress</Text>
              <Text style={styles.progressPercentage}>{Math.round(ridesProgress * 100)}%</Text>
            </View>
            <View style={styles.modernProgressTrack}>
              <View style={[styles.modernProgressFill, { width: `${ridesProgress * 100}%` }]} />
            </View>
            <View style={styles.progressDetails}>
              <Text style={styles.progressText}>
                {acceptedBookings} of {(acceptedBookings || 0) + (bookingsNeeded || 0)} rides completed to breakeven
              </Text>
            </View>
          </View>

          {/* Revenue & Expenses Breakdown */}
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>Breakdown</Text>
            
            {/* Revenue Items */}
            <View style={styles.breakdownGroup}>
              <Text style={styles.breakdownGroupTitle}>Revenue Sources</Text>
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownItemLeft}>
                  <View style={[styles.breakdownDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.breakdownItemText}>Standard Rides</Text>
                </View>
                <Text style={styles.breakdownItemAmount}>₱{formatPeso(shareStandard)}</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownItemLeft}>
                  <View style={[styles.breakdownDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.breakdownItemText}>Ride Hailing</Text>
                </View>
                <Text style={styles.breakdownItemAmount}>₱{formatPeso(shareRideHailing)}</Text>
              </View>
            </View>

            {/* Expense Items */}
            <View style={styles.breakdownGroup}>
              <Text style={styles.breakdownGroupTitle}>Expenses</Text>
              <View style={styles.breakdownItem}>
                <View style={styles.breakdownItemLeft}>
                  <View style={[styles.breakdownDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.breakdownItemText}>Base Expenses</Text>
                </View>
                <Text style={styles.breakdownItemAmount}>₱{formatPeso(dbExpensesBase)}</Text>
              </View>
              {expenseItems.length > 0 && (
                <View style={styles.breakdownItem}>
                  <View style={styles.breakdownItemLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.breakdownItemText}>Session Added</Text>
                  </View>
                  <Text style={styles.breakdownItemAmount}>₱{formatPeso(expenseItems.reduce((sum, n) => sum + (Number(n) || 0), 0))}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Breakeven Chart */}
        <BreakevenChart 
          data={historyItems} 
          currentData={{
            revenue_driver: revenueForTile,
            expenses: totalExpenses,
            period_start: periodStart,
            period_end: periodEnd,
            period_type: frequency === 'Daily' ? 'daily' : frequency === 'Weekly' ? 'weekly' : 'monthly'
          }}
          frequency={frequency}
          onExportPDF={handleChartExportPDF}
        />


        </ScrollView>

        {/* Custom Loading - positioned over ScrollView content only */}
        {loading && !refreshing && (
          <View style={styles.customLoadingOverlay}>
            <View style={styles.loadingContent}>
              <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
                <Image 
                  source={require('../../../assets/TarTrack Logo_sakto.png')} 
                  style={styles.loadingLogo}
                  resizeMode="contain"
                />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.loadingText, { marginRight: 4 }]}>Loading Breakeven</Text>
                  <Animated.Text style={[styles.loadingText, { opacity: dot1Anim }]}>.</Animated.Text>
                  <Animated.Text style={[styles.loadingText, { opacity: dot2Anim }]}>.</Animated.Text>
                  <Animated.Text style={[styles.loadingText, { opacity: dot3Anim }]}>.</Animated.Text>
                </View>
              </Animated.View>
            </View>
          </View>
        )}
      </View>

      <HistoryModal
        visible={historyOpen}
        onClose={closeHistory}
        historyItems={historyItems}
        historyLoading={historyLoading}
        historyError={historyError}
        hasMoreHistory={hasMoreHistory}
        onLoadMore={loadMoreHistory}
        onPickHistory={onPickHistory}
        selectedHistory={selectedHistory}
        historyMode={historyMode}
        setHistoryMode={setHistoryMode}
        pulseAnim={pulseAnim}
      />
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
  notificationRow: {
    paddingHorizontal: 22,
    marginBottom: 5,
    alignItems: 'flex-end',
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
  pdfExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  pdfExportBtnDisabled: {
    opacity: 0.6,
  },
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
  historyBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12, marginLeft: 4 },
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
  // Breakeven Summary Card Styles
  statusSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  periodLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  revenueSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expensesSection: {
    marginBottom: 0,
  },
  // Modern Card Styles
  modernCard: {
    overflow: 'hidden',
  },
  modernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0E7E3',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E7E3',
    borderRadius:15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modernTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  modernSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  modernHistoryBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0E7E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOverview: {
    padding: 16,
    paddingBottom: 12,
  },
  modernStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  modernStatusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },

  progressSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  progressPercentage: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  modernProgressTrack: {
    height: 6,
    backgroundColor: '#F0E7E3',
    borderRadius: 3,
    overflow: 'hidden',
  },
  modernProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressDetails: {
    marginTop: 6,
  },
  progressText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  breakdownSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  breakdownGroup: {
    marginBottom: 12,
  },
  breakdownGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  breakdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  breakdownItemText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  breakdownItemAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  // Additional styles from DriverBreakevenScreen_styles.js
  statusSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  periodLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  revenueSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  expensesSection: {
    marginBottom: 0,
  },
  // Logo loading styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  logo: {
    width: 100,
    height: 100,
  },
  historyLoadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLogo: {
    width: 120,
    height: 120,
  },
  loadMoreLogo: {
    width: 24,
    height: 24,
  },
  scrollContainer: {
    flex: 1,
    position: 'relative',
  },
  customLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    zIndex: 1000,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    marginTop: -100,
    width: 200,
    height: 200,
  },
  loadingText: {
    marginTop: -70,
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

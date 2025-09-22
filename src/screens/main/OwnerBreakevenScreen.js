// screens/OwnerBreakevenScreen.js
import React, { useMemo, useState, useLayoutEffect, useEffect, useCallback } from 'react';
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

import {
  getDriverEarningsStats,
  getPendingPayoutAmount,
} from '../../services/earningsService';

import { getBreakeven, getBreakevenHistory } from '../../services/Earnings/BreakevenService';

const PERIOD_BY_FREQ = {
  Daily: 'today',
  Weekly: 'week',
  Monthly: 'month',
};

// ---------- helpers & constants ----------
// We want buckets to follow DB/UTC dates so a 2025-09-21Z earning does NOT appear on Sept 22 PH.
const PH_TZ = 'Asia/Manila';
const BUCKET_TZ = 'utc';   // ← bucket by UTC day/week/month to match DB dates
const DISPLAY_TZ = 'ph';   // ← keep formatting readable for drivers; affects server debug only
const PERIOD_LABEL_TZ = BUCKET_TZ === 'utc' ? 'UTC' : PH_TZ;

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
const EXPENSES_KEY = (driverId, periodKey) =>
  `earnings:expenses:v1:${driverId || 'unknown'}:${periodKey || 'today'}`;
const EXPENSES_INPUT_KEY = (driverId, periodKey) =>
  `earnings:expensesInput:v1:${driverId || 'unknown'}:${periodKey || 'today'}`;
const EXPENSES_META_KEY = (driverId, periodKey) =>
  `earnings:expensesMeta:v1:${driverId || 'unknown'}:${periodKey || 'today'}`;

// Resolve driverId from route → auth → supabase
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
        if (data?.user?.id) {
          setId(data.user.id);
        }
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

  // UI state
  const [frequency, setFrequency] = useState('Daily'); // Daily | Weekly | Monthly
  const [freqOpen, setFreqOpen] = useState(false);

  // Expenses input + list that accumulates to Total Expenses
  const [expenseInput, setExpenseInput] = useState('0.00');
  const [expenseItems, setExpenseItems] = useState([]); // numbers only (for now)

  // Breakeven API-driven state
  const [farePerRide, setFarePerRide] = useState(0);
  const [bookingsNeeded, setBookingsNeeded] = useState(0);
  const [acceptedBookings, setAcceptedBookings] = useState(0);
  const [revenuePeriod, setRevenuePeriod] = useState(0);
  const [profitable, setProfitable] = useState(false);
  const [deficitAmount, setDeficitAmount] = useState(0);
  const [periodStart, setPeriodStart] = useState(null);
  const [periodEnd, setPeriodEnd] = useState(null);
  const [shareStandard, setShareStandard] = useState(0);
  const [shareCustom, setShareCustom] = useState(0);

  // Other API-backed state
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [pendingPayoutAmount, setPendingPayoutAmount] = useState(0);

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]); // array of history entry
  const [historyError, setHistoryError] = useState('');
  const [historyMode, setHistoryMode] = useState('list'); // 'list' | 'detail'
  const [selectedHistory, setSelectedHistory] = useState(null);

  // Derived period for API
  const periodKey = PERIOD_BY_FREQ[frequency];

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

  const resetExpensesPersisted = useCallback(async () => {
    if (!driverId) return;
    try {
      setExpenseItems([]);
      setExpenseInput('0.00');
      await AsyncStorage.setItem(EXPENSES_KEY(driverId, periodKey), JSON.stringify([]));
      await AsyncStorage.setItem(EXPENSES_INPUT_KEY(driverId, periodKey), '0.00');
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
      if (!rawMeta) return; // First-time use; nothing to expire yet
      const meta = JSON.parse(rawMeta);
      const ts = Number(meta?.updatedAt || 0);
      if (ts && Date.now() - ts > TTL_MS) {
        await resetExpensesPersisted();
      }
    } catch {}
  }, [driverId, periodKey, resetExpensesPersisted]);

  // ---------- persistence: load on driver/period change (with TTL) ----------
  useEffect(() => {
    if (!driverId) return;
    const loadPersisted = async () => {
      try {
        // TTL check first
        await checkAndExpireIfNeeded();

        const [rawItems, rawInput] = await Promise.all([
          AsyncStorage.getItem(EXPENSES_KEY(driverId, periodKey)),
          AsyncStorage.getItem(EXPENSES_INPUT_KEY(driverId, periodKey)),
        ]);

        if (rawItems) {
          // Backward-compatible parsing: array (old) or object {items}
          let parsed;
          try { parsed = JSON.parse(rawItems); } catch { parsed = []; }
          if (Array.isArray(parsed)) {
            setExpenseItems(parsed.map((n) => Number(n) || 0));
          } else if (parsed && Array.isArray(parsed.items)) {
            setExpenseItems(parsed.items.map((n) => Number(n) || 0));
          } else {
            setExpenseItems([]);
          }
        } else {
          setExpenseItems([]); // default
        }

        if (rawInput != null) {
          setExpenseInput(String(rawInput));
        } else {
          setExpenseInput('0.00');
        }

        // If no meta yet, create one now to start the 24h clock
        const rawMeta = await AsyncStorage.getItem(EXPENSES_META_KEY(driverId, periodKey));
        if (!rawMeta) {
          await AsyncStorage.setItem(
            EXPENSES_META_KEY(driverId, periodKey),
            JSON.stringify({ updatedAt: Date.now() })
          );
        }
      } catch {
        setExpenseItems([]);
        setExpenseInput('0.00');
      }
    };
    loadPersisted();
  }, [driverId, periodKey, checkAndExpireIfNeeded]);

  // Periodic TTL watcher (runs while screen is active)
  useEffect(() => {
    if (!driverId) return;
    const id = setInterval(() => {
      checkAndExpireIfNeeded();
    }, 60 * 1000); // check every minute
    return () => clearInterval(id);
  }, [driverId, periodKey, checkAndExpireIfNeeded]);

  // Persist on every change
  useEffect(() => {
    if (!driverId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EXPENSES_KEY(driverId, periodKey), JSON.stringify(expenseItems));
        // touch meta (so the 24h window reflects activity)
        await markExpensesTouched();
      } catch {}
    })();
  }, [driverId, periodKey, expenseItems, markExpensesTouched]);

  useEffect(() => {
    if (!driverId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EXPENSES_INPUT_KEY(driverId, periodKey), String(expenseInput ?? ''));
      } catch {}
    })();
  }, [driverId, periodKey, expenseInput]);

  // Total expenses is the sum of added entries
  const totalExpenses = useMemo(
    () => expenseItems.reduce((sum, n) => sum + (Number(n) || 0), 0),
    [expenseItems]
  );

  const addExpense = () => {
    const val = parseFloat(String(expenseInput).replace(/,/g, '')) || 0;
    if (val <= 0) return;
    setExpenseItems((items) => [...items, val]);
    setExpenseInput('0.00');
  };

  const clearExpenses = () => {
    setExpenseItems([]);
    setExpenseInput('0.00');
  };

  const fetchBreakevenBlock = useCallback(
    async (drvId, period, expensesNumber) => {
      const res = await getBreakeven({
        driverId: drvId,
        period,
        expenses: expensesNumber,
        bucketTz: BUCKET_TZ,   // ← ensure bucketing matches DB UTC date
        displayTz: DISPLAY_TZ, // ← formatting/debug on server side
      });

      if (res?.success && res?.data) {
        const d = res.data;
        setFarePerRide(Number(d.fare_per_ride || 0));
        setBookingsNeeded(Number(d.bookings_needed || 0));
        setAcceptedBookings(Number(d.total_bookings || 0));
        setRevenuePeriod(Number(d.revenue_period || 0));
        setProfitable(Boolean(d.profitable));
        setDeficitAmount(Number(d.deficit_amount || 0));
        setPeriodStart(d.date_start || null);
        setPeriodEnd(d.date_end || null);

        const br = d.breakdown || {};
        setShareStandard(Number(br.driver_share_from_standard || 0));
        setShareCustom(Number(br.driver_share_from_custom || 0));
      }
    },
    []
  );

  const fetchAll = useCallback(
    async (drvId, currentFrequency) => {
      if (!drvId) return;
      setErrorText('');
      setLoading(true);

      try {
        const period = PERIOD_BY_FREQ[currentFrequency];

        const base = await getDriverEarningsStats(drvId, period);
        const baseData = base?.success ? base.data : null;
        setStats(baseData || null);

        const pending = await getPendingPayoutAmount(drvId);
        setPendingPayoutAmount(pending?.data?.amount || 0);

        await fetchBreakevenBlock(drvId, period, totalExpenses);
      } catch (e) {
        setErrorText((e && (e.message || e.toString())) || 'Failed to load earnings. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [fetchBreakevenBlock, totalExpenses]
  );

  useEffect(() => {
    fetchAll(driverId, frequency);
  }, [driverId, frequency, fetchAll]);

  useEffect(() => {
    if (!driverId) return;
    const handler = setTimeout(() => {
      fetchBreakevenBlock(driverId, periodKey, totalExpenses);
    }, 200);
    return () => clearTimeout(handler);
  }, [driverId, periodKey, totalExpenses, fetchBreakevenBlock]);

  const onRefresh = useCallback(async () => {
    if (!driverId) return;
    setRefreshing(true);
    await fetchAll(driverId, frequency);
    setRefreshing(false);
  }, [driverId, frequency, fetchAll]);

  const onResetInputs = () => {
    clearExpenses();
    // also reset the persisted values (and meta timer)
    resetExpensesPersisted();
  };

  // Profit for the tile = revenue_period - totalExpenses
  const currentProfit = useMemo(() => (revenuePeriod || 0) - (totalExpenses || 0), [revenuePeriod, totalExpenses]);
  const profitPositive = currentProfit >= 0;
  const hasNetProfit = currentProfit > 0;

  // Derived: progress & safety margin
  const ridesProgress = useMemo(() => {
    if (!bookingsNeeded || bookingsNeeded <= 0) return 0;
    return clamp01((acceptedBookings || 0) / bookingsNeeded);
  }, [bookingsNeeded, acceptedBookings]);

  const safetyMarginPct = useMemo(() => {
    if (!profitPositive || !totalExpenses) return null;
    return (currentProfit / totalExpenses) * 100;
  }, [profitPositive, currentProfit, totalExpenses]);

  // ===== History (Reports) =====
  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryMode('list');
    setSelectedHistory(null);
    setHistoryError('');
    setHistoryLoading(true);

    try {
      const periodType = frequency.toLowerCase(); // 'daily' | 'weekly' | 'monthly'
      const res = await getBreakevenHistory({ driverId, periodType, limit: 30, excludeCurrent: true });

      const items = (res?.success && res?.data?.items) ? res.data.items : [];
      setHistoryItems(items || []);
    } catch (e) {
      setHistoryError(e?.message || 'Failed to load history.');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [driverId, frequency]);

  const closeHistory = () => {
    setHistoryOpen(false);
    setSelectedHistory(null);
    setHistoryMode('list');
  };

  const onPickHistory = (h) => {
    setSelectedHistory(h);
    setHistoryMode('detail');
  };

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
              Loading earnings & breakeven…
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
              Added: <Text style={{ fontWeight: '800' }}>{expenseItems.length}</Text> {expenseItems.length === 1 ? 'expense' : 'expenses'}
            </Text>
          </View>

          {/* FARE PER RIDE (read-only) */}
          <Text style={styles.inputLabel}>Fare per rent</Text>
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
          <Text style={styles.inputLabel}>Amount Need to earn</Text>
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
                {formatPeso(revenuePeriod || 0)}
              </Text>
            </View>
          </View>

          {/* Metric tiles (row 2) */}
          <View style={[styles.metricsRow, { marginTop: 10 }]}>
            {/* Accepted Bookings */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>Accepted Bookings</Text>
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
                    { backgroundColor: profitPositive ? '#EAF7EE' : '#FDEEEE' },
                  ]}
                >
                  <Ionicons
                    name={profitPositive ? 'trending-up-outline' : 'trending-down-outline'}
                    size={16}
                    color={profitPositive ? '#2E7D32' : '#C62828'}
                  />
                </View>
                <Text style={styles.metricLabel}>Profit</Text>
              </View>
              <Text
                style={[styles.metricValue, { color: profitPositive ? colors.text : '#C62828' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatPeso(currentProfit)}
              </Text>
            </View>
          </View>

          {/* Status badges row (below metric tiles) */}
          {(profitPositive || hasNetProfit) && (
            <View style={styles.badgeRow}>
              {profitPositive && (
                <View style={[styles.badge, styles.badgeBreakeven]}>
                  <Ionicons name="checkmark-circle" size={14} color="#1B5E20" />
                  <Text style={styles.badgeBreakevenText}>Breakeven hit</Text>
                </View>
              )}

              {hasNetProfit && (
                <View style={[styles.badge, styles.badgeProfit]}>
                  <Ionicons name="cash-outline" size={14} color="#0B5C00" />
                  <Text style={styles.badgeProfitText}>
                    In profit: ₱ {formatPeso(currentProfit)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Guidance banner when currently still no profit */}
          {!profitPositive && (
            <View style={styles.tipBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#0B61A4" style={{ marginRight: 8 }} />
              <Text style={styles.tipText}>
                You have not reached profit yet. Accept about{' '}
                <Text style={{ fontWeight: '800' }}>{bookingsNeeded}</Text> ride(s) in total to cover{' '}
                <Text style={{ fontWeight: '800' }}>
                  ₱ {formatPeso(totalExpenses)}
                </Text>. Current deficit:{' '}
                <Text style={{ fontWeight: '800' }}>
                  ₱ {formatPeso(deficitAmount || Math.max(totalExpenses - (revenuePeriod || 0), 0))}
                </Text>.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={onResetInputs} style={styles.btnOutline} activeOpacity={0.85}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Reset expenses</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onRefresh} style={styles.btnPrimary} activeOpacity={0.9}>
              <Ionicons name="sparkles-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Recalculate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== Breakeven Summary card (WITH summary date under title) ====== */}
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

          {/* Summary date (formatted in BUCKET timezone so labels match bucketing) */}
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
          {profitPositive ? (
            <View style={[styles.callout, styles.calloutSuccess]}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#1B5E20" style={{ marginRight: 8 }} />
              <Text style={styles.calloutText}>
                Safety margin: <Text style={styles.strong}>{safetyMarginPct ? `${safetyMarginPct.toFixed(1)}%` : '—'}</Text>. Keep it up!
              </Text>
            </View>
          ) : (
            <View style={[styles.callout, styles.calloutWarn]}>
              <Ionicons name="alert-outline" size={16} color="#8B2C2C" style={{ marginRight: 8 }} />
              <Text style={styles.calloutText}>
                Current deficit: <Text style={styles.strong}>₱ {formatPeso(deficitAmount)}</Text>.
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
            <Text style={styles.muted}>No expenses added for this period.</Text>
          ) : (
            <View>
              {expenseItems.map((amt, idx) => (
                <View key={idx} style={[styles.mixRow, idx < expenseItems.length - 1 && styles.feedDivider]}>
                  <View style={styles.mixLeft}>
                    <Text style={styles.mixLabel}>Expense #{idx + 1}</Text>
                  </View>
                  <Text style={styles.mixValue}>₱ {formatPeso(amt)}</Text>
                </View>
              ))}

              <View style={[styles.mixRow, { marginTop: 8 }]}>
                <View style={styles.mixLeft}>
                  <Text style={[styles.mixLabel, { fontWeight: '800' }]}>Total Expenses</Text>
                </View>
                <Text style={[styles.mixValue, { fontWeight: '900' }]}>₱ {formatPeso(totalExpenses)}</Text>
              </View>
            </View>
          )}
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
                historyItems.map((h, idx) => {
                  const sm = statusMeta(h);
                  return (
                    <TouchableOpacity
                      key={h.id || idx}
                      style={[styles.historyRow, idx < historyItems.length - 1 && styles.feedDivider]}
                      onPress={() => onPickHistory(h)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyTitle}>{periodLabel(h.period_start, h.period_end /* defaults to PH */)}</Text>
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
                })
              )}
            </View>
          )}

          {historyMode === 'detail' && selectedHistory && (
            <View style={{ maxHeight: 460 }}>
              <Text style={styles.detailDate}>{periodLabel(selectedHistory.period_start, selectedHistory.period_end /* defaults to PH */)}</Text>

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
                <View style={styles.detailCell}>
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
                <View style={styles.mixRow}>
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
  badgeBreakeven: { backgroundColor: '#EAF7EE', borderColor: '#CDEBD1' },
  badgeBreakevenText: { color: '#1B5E20', fontSize: 12, fontWeight: '800', marginLeft: 6 },
  badgeProfit: { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' },
  badgeProfitText: { color: '#0B5C00', fontSize: 12, fontWeight: '800', marginLeft: 6 },
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
  btnOutlineText: { color: colors.primary, fontWeight: '800', fontSize: 12, marginLeft: 6 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
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
  modalBackText: { color: colors.primary, fontWeight: '700', marginLeft: 4 },
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
});

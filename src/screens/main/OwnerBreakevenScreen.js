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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { colors, spacing, card } from '../../styles/global';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';

import { getBreakeven } from '../../services/Earnings/BreakevenService';

const PERIOD_BY_FREQ = {
  Daily: 'today',
  Weekly: 'week',
  Monthly: 'month',
};

// ---------- helpers & constants ----------
const PH_TZ = 'Asia/Manila';
const BUCKET_TZ = 'utc';
const DISPLAY_TZ = 'ph';
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

// ----- local persistence keys & TTL (24h) -----
const TTL_MS = 24 * 60 * 60 * 1000;
const EXPENSES_KEY        = (uid, p) => `earnings:expenses:v1:${uid || 'unknown'}:${p || 'today'}`;
const EXPENSES_INPUT_KEY  = (uid, p) => `earnings:expensesInput:v1:${uid || 'unknown'}:${p || 'today'}`;
const EXPENSES_META_KEY   = (uid, p) => `earnings:expensesMeta:v1:${uid || 'unknown'}:${p || 'today'}`;

// Owner inputs (buffers + lists)
const REVENUE_INPUT_KEY   = (uid, p) => `owner:revenueInput:v2:${uid || 'unknown'}:${p || 'today'}`;
const REVENUE_ITEMS_KEY   = (uid, p) => `owner:revenueItems:v2:${uid || 'unknown'}:${p || 'today'}`;
const EVENTS_INPUT_KEY    = (uid, p) => `owner:eventsInput:v2:${uid || 'unknown'}:${p || 'today'}`;
const EVENTS_ITEMS_KEY    = (uid, p) => `owner:eventsItems:v2:${uid || 'unknown'}:${p || 'today'}`;

// Back-compat (migration from v1 single saved values)
const REVENUE_SAVED_KEY_V1 = (uid, p) => `owner:revenueSaved:v1:${uid || 'unknown'}:${p || 'today'}`;
const EVENTS_SAVED_KEY_V1  = (uid, p) => `owner:eventsSaved:v1:${uid || 'unknown'}:${p || 'today'}`;

// Resolve user id (route → auth → supabase)
function useUserId(route) {
  const [id, setId] = React.useState(route?.params?.userId || route?.params?.driverId || null);

  useEffect(() => {
    (async () => {
      const maybeParam = route?.params?.userId || route?.params?.driverId;
      if (maybeParam && maybeParam !== id) {
        setId(maybeParam);
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
  }, [id, route?.params?.userId, route?.params?.driverId]);

  return id;
}

export default function OwnerBreakevenScreen({ navigation, route }) {
  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerShown: false });
  }, [navigation]);

  const userId = useUserId(route);

  // UI state (default to Monthly for owner)
  const [frequency, setFrequency] = useState('Monthly');
  const [freqOpen, setFreqOpen] = useState(false);

  // Expenses input + list
  const [expenseInput, setExpenseInput] = useState('0.00');
  const [expenseItems, setExpenseItems] = useState([]);

  // Owner inputs (buffers + lists)
  const [revenueInput, setRevenueInput] = useState('0.00');
  const [revenueItems, setRevenueItems] = useState([]); // numbers
  const [eventsInput, setEventsInput]   = useState('0');
  const [eventItems, setEventItems]     = useState([]); // integers

  // API-driven context (kept for date range; summary now uses calculator totals)
  const [periodStart, setPeriodStart] = useState(null);
  const [periodEnd, setPeriodEnd] = useState(null);

  // Other state
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const periodKey = PERIOD_BY_FREQ[frequency];

  // ---------- TTL helpers ----------
  const markTouched = useCallback(async () => {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(
        EXPENSES_META_KEY(userId, periodKey),
        JSON.stringify({ updatedAt: Date.now() })
      );
    } catch {}
  }, [userId, periodKey]);

  const resetAllInputsPersisted = useCallback(async () => {
    if (!userId) return;
    try {
      setExpenseItems([]);
      setExpenseInput('0.00');

      setRevenueInput('0.00');
      setRevenueItems([]);

      setEventsInput('0');
      setEventItems([]);

      await AsyncStorage.multiSet([
        [EXPENSES_KEY(userId, periodKey), JSON.stringify([])],
        [EXPENSES_INPUT_KEY(userId, periodKey), '0.00'],
        [REVENUE_INPUT_KEY(userId, periodKey), '0.00'],
        [REVENUE_ITEMS_KEY(userId, periodKey), JSON.stringify([])],
        [EVENTS_INPUT_KEY(userId, periodKey), '0'],
        [EVENTS_ITEMS_KEY(userId, periodKey), JSON.stringify([])],
        [EXPENSES_META_KEY(userId, periodKey), JSON.stringify({ updatedAt: Date.now() })],
      ]);
    } catch {}
  }, [userId, periodKey]);

  const checkAndExpireIfNeeded = useCallback(async () => {
    if (!userId) return;
    try {
      const rawMeta = await AsyncStorage.getItem(EXPENSES_META_KEY(userId, periodKey));
      if (!rawMeta) return;
      const meta = JSON.parse(rawMeta);
      const ts = Number(meta?.updatedAt || 0);
      if (ts && Date.now() - ts > TTL_MS) {
        await resetAllInputsPersisted();
      }
    } catch {}
  }, [userId, periodKey, resetAllInputsPersisted]);

  // ---------- persistence: load on user/period change (with TTL + migration) ----------
  useEffect(() => {
    if (!userId) return;
    const loadPersisted = async () => {
      try {
        await checkAndExpireIfNeeded();

        const [
          rawExpItems, rawExpInput,
          rawRevItems, rawRevInput,
          rawEvtItems, rawEvtInput,
          // v1 migration
          rawRevSavedV1, rawEvtSavedV1,
        ] = await Promise.all([
          AsyncStorage.getItem(EXPENSES_KEY(userId, periodKey)),
          AsyncStorage.getItem(EXPENSES_INPUT_KEY(userId, periodKey)),
          AsyncStorage.getItem(REVENUE_ITEMS_KEY(userId, periodKey)),
          AsyncStorage.getItem(REVENUE_INPUT_KEY(userId, periodKey)),
          AsyncStorage.getItem(EVENTS_ITEMS_KEY(userId, periodKey)),
          AsyncStorage.getItem(EVENTS_INPUT_KEY(userId, periodKey)),
          AsyncStorage.getItem(REVENUE_SAVED_KEY_V1(userId, periodKey)),
          AsyncStorage.getItem(EVENTS_SAVED_KEY_V1(userId, periodKey)),
        ]);

        // expenses list
        if (rawExpItems) {
          let parsed;
          try { parsed = JSON.parse(rawExpItems); } catch { parsed = []; }
          setExpenseItems(Array.isArray(parsed) ? parsed.map(n => Number(n) || 0) : []);
        } else {
          setExpenseItems([]);
        }

        // revenue list (with v1 migration)
        if (rawRevItems) {
          let parsed;
          try { parsed = JSON.parse(rawRevItems); } catch { parsed = []; }
          setRevenueItems(Array.isArray(parsed) ? parsed.map(n => Number(n) || 0) : []);
        } else {
          const legacy = parseFloat(String(rawRevSavedV1)) || 0;
          setRevenueItems(legacy > 0 ? [legacy] : []);
        }

        // events list (with v1 migration)
        if (rawEvtItems) {
          let parsed;
          try { parsed = JSON.parse(rawEvtItems); } catch { parsed = []; }
          setEventItems(Array.isArray(parsed) ? parsed.map(n => parseInt(n, 10) || 0) : []);
        } else {
          const legacy = parseInt(String(rawEvtSavedV1), 10) || 0;
          setEventItems(legacy > 0 ? [legacy] : []);
        }

        // input buffers
        setExpenseInput(rawExpInput != null ? String(rawExpInput) : '0.00');
        setRevenueInput(rawRevInput != null ? String(rawRevInput) : '0.00');
        setEventsInput(rawEvtInput != null ? String(rawEvtInput) : '0');

        // start TTL if none yet
        const rawMeta = await AsyncStorage.getItem(EXPENSES_META_KEY(userId, periodKey));
        if (!rawMeta) {
          await AsyncStorage.setItem(
            EXPENSES_META_KEY(userId, periodKey),
            JSON.stringify({ updatedAt: Date.now() })
          );
        }
      } catch {
        setExpenseItems([]);
        setExpenseInput('0.00');
        setRevenueItems([]);
        setRevenueInput('0.00');
        setEventItems([]);
        setEventsInput('0');
      }
    };
    loadPersisted();
  }, [userId, periodKey, checkAndExpireIfNeeded]);

  // Periodic TTL watcher
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      checkAndExpireIfNeeded();
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [userId, periodKey, checkAndExpireIfNeeded]);

  // Persist on list changes
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EXPENSES_KEY(userId, periodKey), JSON.stringify(expenseItems));
        await markTouched();
      } catch {}
    })();
  }, [userId, periodKey, expenseItems, markTouched]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(REVENUE_ITEMS_KEY(userId, periodKey), JSON.stringify(revenueItems));
        await markTouched();
      } catch {}
    })();
  }, [userId, periodKey, revenueItems, markTouched]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EVENTS_ITEMS_KEY(userId, periodKey), JSON.stringify(eventItems));
        await markTouched();
      } catch {}
    })();
  }, [userId, periodKey, eventItems, markTouched]);

  // Persist input buffers
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EXPENSES_INPUT_KEY(userId, periodKey), String(expenseInput ?? ''));
        await markTouched();
      } catch {}
    })();
  }, [userId, periodKey, expenseInput, markTouched]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(REVENUE_INPUT_KEY(userId, periodKey), String(revenueInput ?? ''));
        await markTouched();
      } catch {}
    })();
  }, [userId, periodKey, revenueInput, markTouched]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await AsyncStorage.setItem(EVENTS_INPUT_KEY(userId, periodKey), String(eventsInput ?? ''));
        await markTouched();
      } catch {}
    })();
  }, [userId, periodKey, eventsInput, markTouched]);

  // Totals (calculator)
  const totalExpenses = useMemo(
    () => expenseItems.reduce((sum, n) => sum + (Number(n) || 0), 0),
    [expenseItems]
  );
  const totalRevenue = useMemo(
    () => revenueItems.reduce((sum, n) => sum + (Number(n) || 0), 0),
    [revenueItems]
  );
  const totalEvents = useMemo(
    () => eventItems.reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0),
    [eventItems]
  );

  // ONE unified Add: append any non-zero inputs; then reset inputs
  const onAddAll = useCallback(async () => {
    if (!userId) return;

    const updates = [];

    // Expense
    const expVal = parseFloat(String(expenseInput).replace(/,/g, '')) || 0;
    if (expVal > 0) updates.push(['expense', expVal]);

    // Revenue
    const revVal = parseFloat(String(revenueInput).replace(/,/g, '')) || 0;
    if (revVal > 0) updates.push(['revenue', revVal]);

    // Events
    const evtRaw = parseInt(String(eventsInput).replace(/,/g, ''), 10);
    const evtVal = Number.isFinite(evtRaw) && evtRaw > 0 ? evtRaw : 0;
    if (evtVal > 0) updates.push(['event', evtVal]);

    if (updates.length === 0) {
      await markTouched();
      return;
    }

    // Apply updates
    setExpenseItems(items => {
      const add = updates.filter(([k]) => k === 'expense').map(([,v]) => v);
      return add.length ? [...items, ...add] : items;
    });
    setRevenueItems(items => {
      const add = updates.filter(([k]) => k === 'revenue').map(([,v]) => v);
      return add.length ? [...items, ...add] : items;
    });
    setEventItems(items => {
      const add = updates.filter(([k]) => k === 'event').map(([,v]) => v);
      return add.length ? [...items, ...add] : items;
    });

    // Reset inputs
    setExpenseInput('0.00');
    setRevenueInput('0.00');
    setEventsInput('0');

    await markTouched();
  }, [userId, expenseInput, revenueInput, eventsInput, markTouched]);

  // Fetch for date range (summary shows period dates)
  const fetchBreakevenBlock = useCallback(
    async (uid, period, expensesNumber) => {
      const res = await getBreakeven({
        driverId: uid,
        period,
        expenses: expensesNumber,
        bucketTz: BUCKET_TZ,
        displayTz: DISPLAY_TZ,
      });

      if (res?.success && res?.data) {
        const d = res.data;
        setPeriodStart(d.date_start || null);
        setPeriodEnd(d.date_end || null);
      }
    },
    []
  );

  const fetchAll = useCallback(
    async (uid, currentFrequency) => {
      if (!uid) return;
      setErrorText('');
      setLoading(true);
      try {
        const period = PERIOD_BY_FREQ[currentFrequency];
        await fetchBreakevenBlock(uid, period, totalExpenses);
      } catch (e) {
        setErrorText((e && (e.message || e.toString())) || 'Failed to load.');
      } finally {
        setLoading(false);
      }
    },
    [fetchBreakevenBlock, totalExpenses]
  );

  useEffect(() => {
    fetchAll(userId, frequency);
  }, [userId, frequency, fetchAll]);

  // Re-fetch dates when expenses change (debounced)
  useEffect(() => {
    if (!userId) return;
    const handler = setTimeout(() => {
      fetchBreakevenBlock(userId, periodKey, totalExpenses);
    }, 200);
    return () => clearTimeout(handler);
  }, [userId, periodKey, totalExpenses, fetchBreakevenBlock]);

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchAll(userId, frequency);
    setRefreshing(false);
  }, [userId, frequency, fetchAll]);

  const onResetInputs = () => {
    resetAllInputsPersisted();
  };

  // ── Derived (calculator) ──
  const currentProfit = useMemo(
    () => (totalRevenue || 0) - (totalExpenses || 0),
    [totalRevenue, totalExpenses]
  );
  const profitPositive = currentProfit >= 0;
  const hasNetProfit = currentProfit > 0;

  // Fare per rent/event = totalRevenue / totalEvents
  const farePerEvent = useMemo(() => {
    if (!totalEvents || totalEvents <= 0) return 0;
    return (totalRevenue || 0) / totalEvents;
  }, [totalRevenue, totalEvents]);

  // Peso amount still needed to hit breakeven
  const amountNeedToEarn = useMemo(() => {
    const need = (totalExpenses || 0) - (totalRevenue || 0);
    return need > 0 ? need : 0;
  }, [totalExpenses, totalRevenue]);

  // NEW: packages needed based on calculator (using farePerEvent)
  const calcPackagesNeeded = useMemo(() => {
    if (farePerEvent > 0) {
      return Math.ceil((totalExpenses || 0) / farePerEvent);
    }
    return 0;
  }, [farePerEvent, totalExpenses]);

  const acceptedPackages = totalEvents || 0;

  // NEW: progress based on calculator pesos (revenue vs expenses)
  const revenueProgress = useMemo(() => {
    if (!isFinite(totalExpenses) || totalExpenses <= 0) return 1; // 100% if no expenses
    return clamp01((totalRevenue || 0) / totalExpenses);
  }, [totalRevenue, totalExpenses]);

  // Safety margin (same as before)
  const safetyMarginPct = useMemo(() => {
    if (!profitPositive || !totalExpenses) return null;
    return (currentProfit / totalExpenses) * 100;
  }, [profitPositive, currentProfit, totalExpenses]);

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
              Loading breakeven…
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
          {/* EXPENSE input */}
          <Text style={styles.inputLabel}>Input Expenses</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={styles.input}
              value={expenseInput}
              onChangeText={setExpenseInput}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
          </View>

          {/* Manual Revenue (buffer) */}
          <Text style={styles.inputLabel}>Input Revenue</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="wallet-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={styles.input}
              value={revenueInput}
              onChangeText={setRevenueInput}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
          </View>

          {/* Manual No. of Events/Rents (buffer) */}
          <Text style={styles.inputLabel}>Input Number of Events/Rents</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.input, { paddingLeft: 0 }]}
              value={String(eventsInput)}
              onChangeText={setEventsInput}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
            />
          </View>

          {/* ONE unified Add button */}
          <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity onPress={onAddAll} style={styles.btnPrimary} activeOpacity={0.9}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Fare per rent/event = totalRevenue / totalEvents */}
          <Text style={styles.inputLabel}>Fare per rent/event (computed)</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="timetable" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={[styles.input, { color: '#687076' }]}
              value={(farePerEvent || 0).toFixed(2)}
              editable={false}
              selectTextOnFocus={false}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Amount Need to Earn (peso) */}
          <Text style={styles.inputLabel}>Amount Need to Earn (to breakeven)</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="target-variant" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={[styles.input, { color: '#687076' }]}
              value={(amountNeedToEarn || 0).toFixed(2)}
              editable={false}
              selectTextOnFocus={false}
              keyboardType="numeric"
              placeholder="0.00"
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
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {formatPeso(totalExpenses)}
              </Text>
            </View>

            {/* Total Revenue */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>Revenue ({frequency.toLowerCase()})</Text>
              </View>
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {formatPeso(totalRevenue)}
              </Text>
            </View>
          </View>

          {/* Metric tiles (row 2) */}
          <View style={[styles.metricsRow, { marginTop: 10 }]}>
            {/* Total Events/Rents */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>No. of Events/Rents</Text>
              </View>
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {totalEvents || 0}
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
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatPeso(currentProfit)}
              </Text>
            </View>
          </View>

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

          {!profitPositive && (
            <View style={styles.tipBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#0B61A4" style={{ marginRight: 8 }} />
              <Text style={styles.tipText}>
                You need <Text style={{ fontWeight: '800' }}>₱ {formatPeso(amountNeedToEarn)}</Text> more to breakeven.
                Any amount above this will be profit.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={onResetInputs} style={styles.btnOutline} activeOpacity={0.85}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Reset inputs</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onRefresh} style={styles.btnPrimary} activeOpacity={0.9}>
              <Ionicons name="sparkles-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Recalculate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ====== Breakeven Summary (reflects calculator data) ====== */}
        <View style={[card, styles.elevatedCard]}>
          <View style={styles.summaryHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="progress-clock" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Breakeven Summary</Text>
            </View>
          </View>

          {/* Summary date */}
          <View style={styles.summaryDateWrap}>
            <Text style={styles.summaryDateLabel}>Summary date</Text>
            <Text style={styles.summaryDateValue}>{periodLabel(periodStart, periodEnd, PERIOD_LABEL_TZ)}</Text>
          </View>

          {/* Summary line based on calculator */}
          <Text style={styles.summaryLine}>
            Breakeven at <Text style={styles.strong}>{calcPackagesNeeded || 0}</Text> rent/event package(s). You’re at{' '}
            <Text style={styles.strong}>{acceptedPackages}</Text>.
          </Text>

          {/* Progress bar based on revenue vs expenses */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${revenueProgress * 100}%` }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>{Math.round(revenueProgress * 100)}%</Text>
            <Text style={styles.progressMetaText}>({acceptedPackages}/{calcPackagesNeeded || 0})</Text>
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
                Amount to breakeven: <Text style={styles.strong}>₱ {formatPeso(amountNeedToEarn)}</Text>.
              </Text>
            </View>
          )}
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
  btnOutlineText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
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
});

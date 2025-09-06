// screens/EarningsScreen.js
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { colors, spacing, card } from '../../styles/global';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';

import {
  getDriverEarnings,
  getDriverEarningsStats,
  getEarningsPercentageChange,
  getDailyIncome,                 // daily totals (finalized only)
  getPendingPayoutAmount,         // admin pending payout by user id
  getLatestFinalizedEarnings,     // latest 5 finalized (fallback)
  getNotifications,               // 🔔 notifications feed
  formatCurrency,
  formatPercentage,
} from '../../services/earningsService';

// --- Helpers ----------------------------------------------------

const peso = (n) =>
  `₱ ${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Render timestamps in Asia/Manila regardless of device timezone
function formatMnlDateTime(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function addDaysISO(d, delta) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x.toISOString().split('T')[0];
}

const PERIOD_BY_FREQ = {
  Daily: 'today',
  Weekly: 'week',
  Monthly: 'month',
};

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

// --- Component --------------------------------------------------

export default function EarningsScreen({ navigation, route }) {
  useLayoutEffect(() => {
    navigation?.setOptions?.({ headerShown: false });
  }, [navigation]);

  const driverId = useDriverId(route);

  // UI state
  const [frequency, setFrequency] = useState('Daily'); // Daily | Weekly | Monthly
  const [freqOpen, setFreqOpen] = useState(false);

  // Break-even inputs (local-only)
  const [expenses, setExpenses] = useState('1500.00');
  const [fare, setFare] = useState('500.00');
  const [bookings, setBookings] = useState('5');

  // API-backed state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState({ up: true, pct: '0.0%' });
  const [feed, setFeed] = useState([]); // 🔔 unified feed (notifications first; fallback: finalized earnings)
  const [errorText, setErrorText] = useState('');
  const [pendingPayoutAmount, setPendingPayoutAmount] = useState(0);

  // Local computed values for break-even
  const totalRevenue = useMemo(() => {
    const f = parseFloat(String(fare).replace(/,/g, '')) || 0;
    const b = parseInt(String(bookings).replace(/[^0-9]/g, ''), 10) || 0;
    return f * b;
  }, [fare, bookings]);

  const profit = useMemo(() => {
    const exp = parseFloat(String(expenses).replace(/,/g, '')) || 0;
    return totalRevenue - exp;
  }, [totalRevenue, expenses]);

  const incomeTitle =
    frequency === 'Daily' ? 'Daily Income' : frequency === 'Weekly' ? 'Weekly Income' : 'Monthly Income';

  // --- Fetchers -------------------------------------------------

  // Daily trend using base API (today vs yesterday)
  const fetchDailyTrend = useCallback(
    async (drvId) => {
      try {
        const today = todayISO();
        const yesterday = addDaysISO(new Date(), -1);

        const [curr, prev] = await Promise.all([
          getDriverEarnings(drvId, { date_from: today }),                  // today from 00:00 → now
          getDriverEarnings(drvId, { date_from: yesterday, date_to: today }), // yesterday full day
        ]);

        const currAmt = curr?.success ? curr?.data?.statistics?.total_driver_earnings || 0 : 0;
        const prevAmt = prev?.success ? prev?.data?.statistics?.total_driver_earnings || 0 : 0;

        let pct = 0;
        let up = true;
        if (prevAmt > 0) {
          pct = ((currAmt - prevAmt) / prevAmt) * 100;
          up = pct >= 0;
        } else if (currAmt > 0) {
          pct = 100;
          up = true;
        }
        return { up, pct: `${Math.abs(pct).toFixed(1)}%` };
      } catch {
        return { up: true, pct: '0.0%' };
      }
    },
    []
  );

  const fetchFeed = useCallback(async (drvId) => {
    // 1) Try notifications
    const notif = await getNotifications(drvId, 5).catch(() => ({ success: false, data: [] }));
    if (notif?.success && Array.isArray(notif.data) && notif.data.length > 0) {
      return notif.data.map(n => ({
        __kind: 'notification',
        id: n.id,
        type: n.type,                     // payout_released | payout_pending_updated | earning_added
        title: n.title,
        message: n.message,
        amount: n.amount,
        ts: n.generated_at,               // Asia/Manila ISO from API
        meta: n.meta || {},
      }));
    }

    // 2) Fallback to latest finalized earnings
    const latest = await getLatestFinalizedEarnings(drvId, 5).catch(() => ({ success: false, data: [] }));
    return (latest?.data || []).map(e => ({
      __kind: 'earning',
      id: e.id,
      amount: e.driver_earnings || e.amount || 0,
      package_name: e.package_name,
      ts: e.earning_date,
      raw: e,
    }));
  }, []);

  const fetchAll = useCallback(
    async (drvId, currentFrequency) => {
      if (!drvId) return;
      setErrorText('');
      setLoading(true);

      try {
        const period = PERIOD_BY_FREQ[currentFrequency];

        // Base stats for the selected period
        const base = await getDriverEarningsStats(drvId, period);
        const baseData = base?.success ? base.data : null;

        // Pending payout for this driver (Admin → Pending)
        const pending = await getPendingPayoutAmount(drvId);
        setPendingPayoutAmount(pending?.data?.amount || 0);

        // 🔔 Unified FEED (notifications → fallback finalized)
        const f = await fetchFeed(drvId);
        setFeed(f);

        if (currentFrequency === 'Daily') {
          // Exact daily (finalized only) for the top card
          const daily = await getDailyIncome(drvId);
          const di = daily?.data || { amount: 0, count: 0, earnings: [] };

          const merged = {
            ...(baseData || {}),
            period: 'today',
            total_driver_earnings: di.amount,
            earnings_today: di.amount,
            completed_bookings_today: di.count,
          };

          setStats(merged);

          // trend for daily
          const t = await fetchDailyTrend(drvId);
          setTrend({ up: t.up, pct: t.pct });
        } else {
          // Weekly / Monthly: stick to base stats
          setStats(baseData || null);

          // trend via % change endpoint
          const pc = await getEarningsPercentageChange(
            drvId,
            currentFrequency === 'Weekly' ? 'week' : 'month'
          );
          const up = !!pc?.data?.is_increase;
          const pct = formatPercentage(pc?.data?.percentage_change || 0);
          setTrend({ up, pct });
        }
      } catch (e) {
        setErrorText((e && (e.message || e.toString())) || 'Failed to load earnings. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [fetchDailyTrend, fetchFeed]
  );

  // Initial + on frequency change
  useEffect(() => {
    fetchAll(driverId, frequency);
  }, [driverId, frequency, fetchAll]);

  // Live polling every 15s
  useEffect(() => {
    if (!driverId) return;
    const id = setInterval(() => {
      fetchAll(driverId, frequency);
    }, 15000);
    return () => clearInterval(id);
  }, [driverId, frequency, fetchAll]);

  const onRefresh = useCallback(async () => {
    if (!driverId) return;
    setRefreshing(true);
    await fetchAll(driverId, frequency);
    setRefreshing(false);
  }, [driverId, frequency, fetchAll]);

  // Amount on the card — driven by getDailyIncome for Daily
  const incomeAmount = useMemo(() => {
    if (!stats) return 0;
    return stats.total_driver_earnings ?? stats.earnings_today ?? 0;
  }, [stats]);

  const incomeSubtitle = useMemo(() => {
    if (!stats) {
      return frequency === 'Daily' ? 'From recent tours' : 'Right on track—keep going!';
    }
    if (stats.period === 'today') {
      const n = stats.completed_bookings_today || 0;
      return n === 1 ? '1 completed booking today' : `${n} completed bookings today`;
    }
    const ct = stats.count || 0;
    const avg = stats.avg_earning_per_booking || 0;
    return `${ct} completed · ${formatCurrency(avg)} avg/booking`;
  }, [stats, frequency]);

  // To be paid — Admin uses pending payout amount for this user
  const toBePaid = [
    { label: 'Admin', amount: pendingPayoutAmount, status: pendingPayoutAmount > 0 ? 'Pending' : '—' },
    { label: 'Owner', amount: stats?.total_driver_earnings ?? 0, status: 'Paid' },
  ];

  // --- Feed render helpers ---------------------------------------------------

  function iconForItem(it) {
    if (it.__kind === 'notification') {
      switch (it.type) {
        case 'payout_released':        return 'check-circle-outline';
        case 'payout_pending_updated': return 'progress-clock';
        case 'earning_added':          return 'calendar-account';
        default:                       return 'bell-circle';
      }
    }
    // fallback earnings row
    return 'calendar-account';
  }

  function textForItem(it) {
    if (it.__kind === 'notification') {
      // Prefer server-sent message; fallback to title
      return it.message || it.title || 'New update';
    }
    // fallback earnings row message
    const amt = peso(it.amount || 0);
    const pkg = it.package_name ? ` from ${it.package_name}` : ' from your tour';
    return `You’ve earned ${amt}${pkg}`;
  }

  function timeForItem(it) {
    return formatMnlDateTime(it.ts);
  }

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
      >
        {/* Error banner */}
        {!!errorText && (
          <View style={{ marginHorizontal: 20, marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#fdecea' }}>
            <Text style={{ color: '#b3261e', fontWeight: '600' }}>{errorText}</Text>
          </View>
        )}

        {/* INCOME */}
        <View style={[card, styles.incomeCard]}>
          <View style={styles.incomeTopRow}>
            <Text style={styles.incomeTitle}>
              {incomeTitle}
            </Text>
            <View style={[styles.trendChip, { backgroundColor: trend.up ? '#EAF7EE' : '#FDEEEE' }]}>
              <Ionicons
                name={trend.up ? 'trending-up-outline' : 'trending-down-outline'}
                size={14}
                color={trend.up ? '#2E7D32' : '#C62828'}
              />
              <Text style={[styles.trendText, { color: trend.up ? '#2E7D32' : '#C62828' }]}>{trend.pct}</Text>
            </View>
          </View>

          <View style={styles.incomeMainRow}>
            <View style={{ flex: 1 }}>
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.incomeAmount}>{peso(incomeAmount)}</Text>
              )}
              <Text style={styles.incomeSub}>
                {incomeSubtitle}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.detailBtn}
              activeOpacity={0.8}
              onPress={onRefresh}
              accessibilityLabel="Refresh earnings"
            >
              <Ionicons name="refresh" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.segmentRow}>
            {['Daily', 'Weekly', 'Monthly'].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFrequency(f)}
                style={[styles.segmentBtn, frequency === f && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, frequency === f && styles.segmentTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* TO BE PAID */}
        <Text style={styles.sectionTitle}>To be Paid</Text>
        <View style={[card, styles.cardTight]}>
          {toBePaid.map((item, idx) => (
            <View key={`${item.label}-${idx}`}>
              <View style={styles.toBePaidRow}>
                <Text style={styles.toBePaidLabel}>{item.label}</Text>
                <Text style={styles.toBePaidAmount}>{peso(item.amount)}</Text>
                <View style={[styles.statusPill, item.status === 'Paid' ? styles.pillPaid : styles.pillPending]}>
                  <Text style={[styles.statusText, item.status === 'Paid' ? styles.paid : styles.pending]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              {idx < toBePaid.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* EARNINGS FEED (notifications first; fallback to latest finalized) */}
        <Text style={styles.sectionTitle}>Earnings</Text>
        <View style={[card, styles.cardTight]}>
          {(feed || []).map((it, i, arr) => (
            <View key={it.id || i} style={[styles.earningRow, i < arr.length - 1 && styles.feedDivider]}>
              <View style={styles.feedIcon}>
                <MaterialCommunityIcons name={iconForItem(it)} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningMsg}>{textForItem(it)}</Text>
                {it.ts ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    {timeForItem(it)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {!loading && (!feed || feed.length === 0) && (
            <Text style={{ color: colors.textSecondary, paddingVertical: spacing.md, textAlign: 'center' }}>
              No recent notifications yet.
            </Text>
          )}
          {loading && <ActivityIndicator style={{ paddingVertical: spacing.md }} />}
        </View>

        {/* BREAK-EVEN */}
        <View style={styles.breakEvenHeader}>
          <Text style={styles.sectionTitle}>Break Even Calculator</Text>

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
                      <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>{opt}</Text>
                      {active && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <View style={[card, styles.cardTight]}>
          <Text style={styles.inputLabel}>Total Expenses</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={styles.input}
              value={expenses}
              onChangeText={setExpenses}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Text style={styles.inputLabel}>Fare per rent</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>₱</Text>
            <TextInput
              style={styles.input}
              value={fare}
              onChangeText={setFare}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Text style={styles.inputLabel}>Booking you need to accept</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { paddingLeft: 0 }]}
              value={bookings}
              onChangeText={setBookings}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Text style={styles.inputLabel}>Total Revenue</Text>
          <View style={styles.inputWrapDisabled}>
            <Text style={styles.inputPrefix}>₱</Text>
            <Text style={styles.inputDisabledText}>
              {Number(totalRevenue).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <Text style={styles.inputLabel}>Profit</Text>
          <View style={styles.inputWrapDisabled}>
            <Text style={styles.inputPrefix}>₱</Text>
            <Text style={styles.inputDisabledText}>
              {Number(profit).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* REPORTS */}
        <View style={styles.breakEvenHeader}>
          <Text style={styles.sectionTitle}>Breakeven Reports</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.viewAllText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <View style={[card, styles.cardTight]}>
          {[
            {
              id: 1,
              title: 'Income today',
              desc: `You earned ${formatCurrency(stats?.total_driver_earnings || 0)} so far.`,
              time: '—',
            },
          ].map((r, idx, arr) => (
            <View key={r.id} style={[styles.reportRow, idx < arr.length - 1 && styles.feedDivider]}>
              <View style={styles.feedIcon}>
                <MaterialCommunityIcons name="chart-areaspline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle}>{r.title}</Text>
                <Text style={styles.reportDesc}>{r.desc}</Text>
              </View>
              <Text style={styles.earningTime}>{r.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ============================ Styles ============================ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Income card */
  incomeCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    marginLeft: 20,
    marginRight: 20,
  },
  incomeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  incomeTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  trendChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  trendText: { fontWeight: '800', fontSize: 12 },
  incomeMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  incomeAmount: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: 0.2 },
  incomeSub: { color: colors.textSecondary, marginTop: 2, fontSize: 12 },
  detailBtn: {
    backgroundColor: '#6B2E2B',
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 999,
    padding: 4,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' },
  segmentText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  segmentTextActive: { color: colors.text },

  /* Section headings */
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 20,
    marginBottom: 5,
  },

  /* Cards list spacing */
  cardTight: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    marginLeft: 20,
    marginRight: 20,
  },

  /* To be Paid */
  toBePaidRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowDivider: { height: 1, backgroundColor: colors.border, opacity: 0.6 },
  toBePaidLabel: { flex: 1, color: colors.text, fontWeight: '500', fontSize: 13 },
  toBePaidAmount: { color: colors.text, fontWeight: '800', marginRight: spacing.md, fontSize: 13 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusText: { fontWeight: '800', fontSize: 12 },
  pillPaid: { backgroundColor: '#E8F5E9', borderColor: '#E8F5E9' },
  pillPending: { backgroundColor: '#E5E5E5', borderColor:'#E5E5E5' },
  paid: { color: colors.accent },
  pending: { color: colors.primary },

  /* Feed */
  earningRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md },
  feedDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feedIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F4ECE8',
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  earningMsg: { color: colors.text, fontSize: 13, fontWeight: '500' },
  earningTime: { color: colors.textSecondary, fontSize: 12, marginLeft: spacing.sm },

  /* Break-even header + dropdown */
  breakEvenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  dropdownWrap: { position: 'relative', marginRight: 20 },
  frequencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frequencyText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  dropdown: {
    position: 'absolute',
    top: 40, right: 0,
    minWidth: 150, backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
    paddingVertical: 6, zIndex: 10,
  },
  dropdownItem: {
    paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownItemActive: { backgroundColor: '#F7F7F7' },
  dropdownText: { color: colors.text, fontSize: 13 },
  dropdownTextActive: { color: colors.primary, fontWeight: '700' },

  /* Inputs */
  inputLabel: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, marginBottom: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inputPrefix: { color: colors.textSecondary, marginRight: 6 },
  input: { flex: 1, fontSize: 13, color: colors.text, paddingVertical: 0 },

  inputWrapDisabled: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F7F7', borderRadius: 10,
    borderWidth: 1, borderColor: '#ECECEC',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inputDisabledText: { fontSize: 13, color: colors.textSecondary },

  /* Reports */
  viewAllText: { color: colors.primary, fontWeight: '600', fontSize: 13, marginRight: 20 },
  reportRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md },
  reportTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  reportDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});

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
import { useScreenAutoRefresh } from '../../services/dataInvalidationService';

import {
  getDriverEarningsStats,
  getPendingPayoutAmount,
  formatCurrency,
} from '../../services/earningsService';

import { getBreakeven } from '../../services/Earnings/BreakevenService';

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
  const [expenseItems, setExpenseItems] = useState([]); // numbers

  // Breakeven API-driven state
  const [farePerRide, setFarePerRide] = useState(0);           // revenue/accepted bookings
  const [bookingsNeeded, setBookingsNeeded] = useState(0);     // how many to breakeven
  const [acceptedBookings, setAcceptedBookings] = useState(0); // accepted in period
  const [revenuePeriod, setRevenuePeriod] = useState(0);       // driver-share revenue
  const [profitable, setProfitable] = useState(false);
  const [deficitAmount, setDeficitAmount] = useState(0);

  // Other API-backed state
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [pendingPayoutAmount, setPendingPayoutAmount] = useState(0);

  // Derived period for API
  const periodKey = PERIOD_BY_FREQ[frequency];

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
      });

      if (res?.success && res?.data) {
        const d = res.data;
        setFarePerRide(Number(d.fare_per_ride || 0));
        setBookingsNeeded(Number(d.bookings_needed || 0));
        setAcceptedBookings(Number(d.total_bookings || 0));
        setRevenuePeriod(Number(d.revenue_period || 0));
        setProfitable(Boolean(d.profitable));
        setDeficitAmount(Number(d.deficit_amount || 0));
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

  // Auto-refresh when earnings data changes
  useScreenAutoRefresh('EARNINGS', () => {
    console.log('[EarningsScreen] Auto-refreshing due to data changes');
    if (driverId) fetchAll(driverId, frequency);
  });

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

  const onResetInputs = () => {
    clearExpenses();
  };

  // Profit for the tile = revenue_period - totalExpenses
  const currentProfit = useMemo(() => (revenuePeriod || 0) - (totalExpenses || 0), [revenuePeriod, totalExpenses]);
  const profitPositive = currentProfit >= 0;
  const hasNetProfit = currentProfit > 0;

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
          <Text style={styles.cardSubtitle}>Enter your assumptions</Text>

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

          {/* Small summary row for expenses list */}
          <View style={styles.expenseSummaryRow}>
            <Text style={styles.expenseSummaryText}>
              Added:{' '}
              <Text style={{ fontWeight: '800' }}>
                {expenseItems.length}
              </Text>{' '}
              {expenseItems.length === 1 ? 'expense' : 'expenses'}
            </Text>
            {/* Clear button removed on request (use "Reset expenses" below) */}
          </View>

          {/* FARE PER RIDE (from API – read-only) */}
          <Text style={styles.inputLabel}>Fare per ride (driver share / booking accepted)</Text>
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

          {/* BOOKINGS NEEDED (from API – read-only) */}
          <Text style={styles.inputLabel}>Bookings you need to accept (auto)</Text>
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
            {/* Total Expenses tile */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="card-outline" size={16} color={colors.primary} />
                </View>
                <Text
                  style={styles.metricLabel}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  Total Expenses
                </Text>
              </View>
              <Text
                style={styles.metricValue}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {Number(totalExpenses).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Revenue (period) tile */}
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                </View>
                <Text
                  style={styles.metricLabel}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  Revenue ({frequency.toLowerCase()})
                </Text>
              </View>
              <Text
                style={styles.metricValue}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {Number(revenuePeriod || 0).toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
                <Text
                  style={styles.metricLabel}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  Accepted Bookings
                </Text>
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
                <Text
                  style={styles.metricLabel}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  Profit
                </Text>
              </View>
              <Text
                style={[styles.metricValue, { color: profitPositive ? colors.text : '#C62828' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {Number(currentProfit).toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
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
                    In profit: ₱{' '}
                    {Number(currentProfit).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
                  ₱ {Number(totalExpenses).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>. Current deficit:{' '}
                <Text style={{ fontWeight: '800' }}>
                  ₱ {Number(deficitAmount || Math.max(totalExpenses - (revenuePeriod || 0), 0)).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
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

        {/* Reports */}
        <View style={styles.sectionRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="chart-areaspline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Breakeven Reports</Text>
          </View>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.viewAllText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={[card, styles.elevatedCard, styles.cardTight]}>
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
                <MaterialCommunityIcons name="lightning-bolt-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle} numberOfLines={1} ellipsizeMode="tail">{r.title}</Text>
                <Text style={styles.reportDesc} numberOfLines={2} ellipsizeMode="tail">{r.desc}</Text>
              </View>
              <Text style={styles.earningTime} numberOfLines={1} ellipsizeMode="tail">{r.time}</Text>
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

  /* Error */
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

  /* Tip */
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

  /* Section header */
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
  },

  /* Dropdown */
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

  /* Cards */
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
  cardTight: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },

  /* Inputs */
  inputLabel: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.sm, marginBottom: 6, fontWeight: '700' },
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

  // Add button beside expenses input
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

  /* Metric tiles */
  metricsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
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
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
    minWidth: 0,
    flexShrink: 1,
  },

  /* Badges */
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeBreakeven: {
    backgroundColor: '#EAF7EE',
    borderColor: '#CDEBD1',
  },
  badgeBreakevenText: {
    color: '#1B5E20',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  badgeProfit: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  badgeProfitText: {
    color: '#0B5C00',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },

  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
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
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 6 },

  /* Reports */
  viewAllText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  reportRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md },
  feedDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F4ECE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  reportTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  reportDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  earningTime: { color: colors.textSecondary, fontSize: 12, marginLeft: spacing.sm },
});

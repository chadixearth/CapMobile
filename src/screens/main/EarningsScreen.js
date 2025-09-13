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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { colors, spacing, card } from '../../styles/global';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';

import {
  getDriverEarningsStats,
  getPendingPayoutAmount, // admin pending payout by user id
  formatCurrency,
} from '../../services/earningsService';

/* ---------- Helpers ---------- */

const peso = (n) =>
  `₱ ${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

/* ---------- Component ---------- */

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
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
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

  const fetchAll = useCallback(
    async (drvId, currentFrequency) => {
      if (!drvId) return;
      setErrorText('');

      try {
        const period = PERIOD_BY_FREQ[currentFrequency];

        // Base stats for the selected period
        const base = await getDriverEarningsStats(drvId, period);
        const baseData = base?.success ? base.data : null;
        setStats(baseData || null);

        // Pending payout for this driver (Admin → Pending)
        const pending = await getPendingPayoutAmount(drvId);
        setPendingPayoutAmount(pending?.data?.amount || 0);
      } catch (e) {
        setErrorText((e && (e.message || e.toString())) || 'Failed to load earnings. Please try again.');
      }
    },
    []
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

  // Kept for logic, UI intentionally removed previously
  const toBePaid = [
    { label: 'Admin', amount: pendingPayoutAmount, status: pendingPayoutAmount > 0 ? 'Pending' : '—' },
    { label: 'Owner', amount: stats?.total_driver_earnings ?? 0, status: 'Paid' },
  ];

  const profitPositive = profit >= 0;

  const onResetInputs = () => {
    setExpenses('1500.00');
    setFare('500.00');
    setBookings('5');
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
                      <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>{opt}</Text>
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

          <Text style={styles.inputLabel}>Total Expenses</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
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
            <MaterialCommunityIcons name="timetable" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
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

          <Text style={styles.inputLabel}>Bookings you need to accept</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.input, { paddingLeft: 0 }]}
              value={bookings}
              onChangeText={setBookings}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Metric tiles */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={styles.iconBubble}>
                  <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.metricLabel}>Total Revenue</Text>
              </View>
              <Text style={styles.metricValue}>
                {Number(totalRevenue).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2, })}
              </Text>
            </View>

            <View style={[styles.metricCard, styles.shadowSoft]}>
              <View style={styles.metricHeader}>
                <View style={[styles.iconBubble, { backgroundColor: profitPositive ? '#EAF7EE' : '#FDEEEE' }]}>
                  <Ionicons
                    name={profitPositive ? 'trending-up-outline' : 'trending-down-outline'}
                    size={16}
                    color={profitPositive ? '#2E7D32' : '#C62828'}
                  />
                </View>
                <Text style={styles.metricLabel}>Profit</Text>
              </View>
              <Text style={[styles.metricValue, { color: profitPositive ? colors.text : '#C62828' }]}>
                {Number(profit).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2, })}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={onResetInputs} style={styles.btnOutline} activeOpacity={0.85}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onRefresh} style={styles.btnPrimary} activeOpacity={0.9}>
              <Ionicons name="sparkles-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Calculate</Text>
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

  /* Dropdown (kept) */
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
  metricLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 0.2 },

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

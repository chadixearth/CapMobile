import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, card } from '../../styles/global';

/** Demo data */
const toBePaid = [
  { label: 'Admin', amount: 100.0, status: 'Pending' },
  { label: 'Owner', amount: 500.0, status: 'Paid' },
];

const earnings = [
  { id: 1, amount: 50.0, time: '11:11' },
  { id: 2, amount: 60.0, time: '11:21' },
  { id: 3, amount: 100.0, time: '11:31' },
  { id: 4, amount: 40.0, time: '11:41' },
];

const breakevenReports = [
  {
    id: 1,
    title: 'Income today',
    desc: 'You earned 500 pesos for May 1, 2025. Set your goals high to earn more!',
    time: '04:00',
  },
  { id: 2, title: 'Midday Income', desc: 'You earned 200 pesos for May 1, 2025.', time: '12:00' },
];

const peso = (n) =>
  `₱ ${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function EarningsScreen() {
  const [frequency, setFrequency] = useState('Daily');
  const [freqOpen, setFreqOpen] = useState(false);
  const freqOptions = ['Daily', 'Weekly', 'Monthly'];

  const [expenses, setExpenses] = useState('1500.00');
  const [fare, setFare] = useState('500.00');
  const [bookings, setBookings] = useState('5');

  const incomeToday = useMemo(() => earnings.reduce((a, e) => a + (e.amount || 0), 0), []);

  const totalRevenue = useMemo(() => {
    const f = parseFloat(String(fare).replace(/,/g, '')) || 0;
    const b = parseInt(String(bookings).replace(/[^0-9]/g, ''), 10) || 0;
    return f * b;
  }, [fare, bookings]);

  const profit = useMemo(() => {
    const exp = parseFloat(String(expenses).replace(/,/g, '')) || 0;
    return totalRevenue - exp;
  }, [totalRevenue, expenses]);

  const trend = { up: true, pct: '+7.2%' };
  const incomeTitle =
    frequency === 'Daily' ? 'Daily Income' : frequency === 'Weekly' ? 'Weekly Income' : 'Monthly Income';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.lg }}>
      {/* INCOME */}
      <View style={[card, styles.incomeCard]}>
        <View style={styles.incomeTopRow}>
          <Text style={styles.incomeTitle}>{incomeTitle}</Text>
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
            <Text style={styles.incomeAmount}>{peso(incomeToday)}</Text>
            <Text style={styles.incomeSub}>
              {frequency === 'Daily' ? 'From recent tours' : 'Right on track—keep going!'}
            </Text>
          </View>

          <TouchableOpacity style={styles.detailBtn}>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
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
          <View key={idx}>
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

      {/* EARNINGS FEED */}
      <Text style={styles.sectionTitle}>Earnings</Text>
      <View style={[card, styles.cardTight]}>
        {earnings.map((e, i) => (
          <View key={e.id} style={[styles.earningRow, i < earnings.length - 1 && styles.feedDivider]}>
            <View style={styles.feedIcon}>
              <MaterialCommunityIcons name="calendar-account" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningMsg}>You’ve earned {peso(e.amount)} from your tour</Text>
            </View>
            <Text style={styles.earningTime}>{e.time}</Text>
          </View>
        ))}
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
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View all reports</Text>
        </TouchableOpacity>
      </View>
      <View style={[card, styles.cardTight]}>
        {breakevenReports.map((r, idx) => (
          <View key={r.id} style={[styles.reportRow, idx < breakevenReports.length - 1 && styles.feedDivider]}>
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
  );
}

/* ============================ Styles ============================ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Income card */
  incomeCard: {
    marginTop: spacing.md,            // was spacing.lg
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
  incomeMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, // tighter
  incomeAmount: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: 0.2 }, // 28 to match previous
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
    marginTop: 8,                     // tighter
    alignSelf: 'flex-end',
  },
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' },
  segmentText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  segmentTextActive: { color: colors.text },

  /* Section headings */
  sectionTitle: {
    fontSize: 14, // match previous prompt
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
  toBePaidLabel: { flex: 1, color: colors.text, fontWeight: '500', fontSize: 13 }, // was 15
  toBePaidAmount: { color: colors.text, fontWeight: '800', marginRight: spacing.md, fontSize: 13 }, // was 15
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
  earningMsg: { color: colors.text, fontSize: 13, fontWeight: '500' }, // was 15
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
  dropdownText: { color: colors.text, fontSize: 13 }, // was 14
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
  input: { flex: 1, fontSize: 13, color: colors.text, paddingVertical: 0 }, // was 15

  inputWrapDisabled: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F7F7', borderRadius: 10,
    borderWidth: 1, borderColor: '#ECECEC',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inputDisabledText: { fontSize: 13, color: colors.textSecondary }, // was 15

  /* Reports */
  viewAllText: { color: colors.primary, fontWeight: '600', fontSize: 13, marginRight: 20 },
  reportRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md },
  reportTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, // was 14
  reportDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});

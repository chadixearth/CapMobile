import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, card } from '../../styles/global';

const toBePaid = [
  { label: 'Admin', amount: '₱ 100.00', status: 'Pending' },
  { label: 'Owner', amount: '₱ 500.00', status: 'Paid' },
];

const earnings = [
  { id: 1, amount: '₱ 50.00', time: '11:11' },
  { id: 2, amount: '₱ 60.00', time: '11:21' },
  { id: 3, amount: '₱ 100.00', time: '11:31' },
  { id: 4, amount: '₱ 40.00', time: '11:41' },
];

const breakevenReports = [
  { id: 1, title: 'Income today', desc: 'You earned 500 pesos for May 1, 2025. Set your goals high to earn more!', time: '04:00' },
  { id: 2, title: 'Midday Income', desc: 'You earned 200 pesos for May 1, 2025.', time: '12:00' },
];

export default function EarningsScreen() {
  const [expenses, setExpenses] = useState('1500.00');
  const [fare, setFare] = useState('500.00');
  const [bookings, setBookings] = useState('5');
  const [revenue, setRevenue] = useState('2000.00');
  const [profit, setProfit] = useState('500.00');
  const [frequency, setFrequency] = useState('Daily');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      {/* Income Card */}
      <View style={[card, styles.incomeCard]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={styles.incomeLabel}>Income</Text>
          <View style={styles.incomeStat}>
            <Ionicons name="trending-up-outline" size={14} color={colors.accent} />
            <Text style={styles.incomeStatText}>+7.2%</Text>
          </View>
          <Text style={styles.incomeHigher}>Higher</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.incomeAmount}>₱ 1,500.00</Text>
          <TouchableOpacity style={styles.incomeArrow}>
            <Ionicons name="arrow-forward-circle" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* To be Paid */}
      <Text style={styles.sectionTitle}>To be Paid</Text>
      <View style={card}>
        {toBePaid.map((item, idx) => (
          <View key={idx} style={styles.toBePaidRow}>
            <Text style={styles.toBePaidLabel}>{item.label}</Text>
            <Text style={styles.toBePaidAmount}>{item.amount}</Text>
            <Text style={[styles.toBePaidStatus, item.status === 'Paid' ? styles.paid : styles.pending]}>{item.status}</Text>
          </View>
        ))}
      </View>

      {/* Earnings */}
      <Text style={styles.sectionTitle}>Earnings</Text>
      <View style={card}>
        {earnings.map((e) => (
          <View key={e.id} style={styles.earningRow}>
            <MaterialCommunityIcons name="calendar-account" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.earningMsg}>You’ve earned {e.amount} from your tour</Text>
            </View>
            <Text style={styles.earningTime}>{e.time}</Text>
          </View>
        ))}
      </View>

      {/* Break Even Calculator */}
      <View style={styles.breakEvenHeader}>
        <Text style={styles.sectionTitle}>Break Even Calculator</Text>
        <TouchableOpacity style={styles.frequencyBtn}>
          <Text style={styles.frequencyText}>Select Frequency</Text>
        </TouchableOpacity>
      </View>
      <View style={card}>
        <Text style={styles.inputLabel}>Total Expenses</Text>
        <TextInput style={styles.input} value={expenses} onChangeText={setExpenses} keyboardType="numeric" />
        <Text style={styles.inputLabel}>Fare per rent</Text>
        <TextInput style={styles.input} value={fare} onChangeText={setFare} keyboardType="numeric" />
        <Text style={styles.inputLabel}>Booking you need to accept</Text>
        <TextInput style={styles.input} value={bookings} onChangeText={setBookings} keyboardType="numeric" />
        <Text style={styles.inputLabel}>Total Revenue</Text>
        <TextInput style={styles.input} value={revenue} onChangeText={setRevenue} keyboardType="numeric" />
        <Text style={styles.inputLabel}>Profit</Text>
        <TextInput style={styles.input} value={profit} onChangeText={setProfit} keyboardType="numeric" />
      </View>

      {/* Breakeven Reports */}
      <View style={styles.breakEvenHeader}>
        <Text style={styles.sectionTitle}>Breakeven Reports</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View all reports</Text>
        </TouchableOpacity>
      </View>
      <View style={card}>
        {breakevenReports.map((r) => (
          <View key={r.id} style={styles.earningRow}>
            <MaterialCommunityIcons name="calendar-account" size={24} color={colors.primary} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.earningMsg}>{r.title}</Text>
              <Text style={styles.earningDesc}>{r.desc}</Text>
            </View>
            <Text style={styles.earningTime}>{r.time}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  incomeCard: { marginTop: spacing.lg },
  incomeLabel: { fontWeight: 'bold', color: colors.accent, marginRight: spacing.sm, fontSize: 16 },
  incomeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eafaf1',
    borderRadius: 8,
    paddingHorizontal: 6,
    marginRight: spacing.sm,
    marginLeft: 2,
  },
  incomeStatText: { color: colors.accent, fontSize: 12, fontWeight: 'bold', marginLeft: 2 },
  incomeHigher: { color: colors.textSecondary, fontSize: 12, marginLeft: 2 },
  incomeAmount: { fontSize: 28, fontWeight: 'bold', color: colors.text, flex: 1 },
  incomeArrow: { marginLeft: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text, marginLeft: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  toBePaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toBePaidLabel: { flex: 1, color: colors.text, fontWeight: '500', fontSize: 15 },
  toBePaidAmount: { color: colors.text, fontWeight: 'bold', marginRight: spacing.md, fontSize: 15 },
  toBePaidStatus: { fontWeight: 'bold', fontSize: 13 },
  paid: { color: colors.primary },
  pending: { color: colors.accent },
  earningsBox: { marginBottom: spacing.md },
  earningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  earningMsg: { color: colors.text, fontSize: 15, fontWeight: '500' },
  earningDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  earningTime: { color: colors.textSecondary, fontSize: 12, marginLeft: spacing.sm },
  breakEvenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  frequencyBtn: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frequencyText: { color: colors.primary, fontWeight: '500', fontSize: 13 },
  inputLabel: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm, marginBottom: 2 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewAllText: { color: colors.primary, fontWeight: '500', fontSize: 13 },
});

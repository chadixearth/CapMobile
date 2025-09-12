import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';
const MAROON_DARK = '#5B2624';
const INK = '#1F2937';
const SUBTLE = '#6B7280';
const CARD = '#FFFFFF';
const SURFACE = '#F6F6F7';
const HAIRLINE = '#ECECEC';
const MUTED_BG = '#FAFAFA';
const CHIP_BG = '#F3ECE8';
const CHIP_BORDER = '#E6DAD2';
const SUCCESS_BG = '#D1FADF';
const SUCCESS_BORDER = '#A6E9C5';
const SUCCESS_DEEP = '#14532D';

export default function PaymentReceiptScreen({ navigation, route }) {
  const { paymentData, bookingData } = route.params ?? {};

  // Helpers
  const formatDate = (dateInput) => {
    try {
      const date = dateInput ? new Date(dateInput) : new Date();
      if (typeof Intl?.DateTimeFormat === 'function') {
        return new Intl.DateTimeFormat('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Manila',
        }).format(date);
      }
      return date.toLocaleString?.() || date.toString();
    } catch {
      return '--';
    }
  };

  const formatCurrency = (amount) => {
    const num = Number(amount ?? 0);
    if (typeof Intl?.NumberFormat === 'function') {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
      }).format(num);
    }
    return `₱${num.toFixed(2)}`;
  };

  const amountPaid = paymentData?.amount ?? bookingData?.amount ?? 0;
  const method = (paymentData?.paymentMethod || '').toString().toUpperCase() || 'N/A';
  const bookingRef = bookingData?.bookingReference || '—';
  const packageName = bookingData?.packageName || '—';
  const paymentId = paymentData?.paymentId || '—';
  const paidAt = formatDate(paymentData?.paidAt || new Date());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SURFACE }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.headerBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Receipt</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Badge */}
        <View style={styles.bannerWrap}>
          <SuccessBadge />
          <Text style={styles.successTitle}>Payment Successful</Text>
          <Text style={styles.successSubtitle}>Your booking has been confirmed</Text>
        </View>

        {/* Receipt Card */}
        <View style={styles.receiptCard}>
          {/* Accent strip */}
          <View style={styles.accent} />

          {/* Amount section */}
          <View style={styles.amountRow}>
            <View>
              <Text style={styles.amountLabel}>Amount Paid</Text>
              <Text style={styles.amountValue}>{formatCurrency(amountPaid)}</Text>
            </View>
            <View style={styles.chipSuccess}>
              <Ionicons name="checkmark-circle" size={14} color={SUCCESS_DEEP} style={{ marginRight: 6 }} />
              <Text style={styles.chipSuccessText}>PAID</Text>
            </View>
          </View>

          {/* Chips row */}
          <View style={styles.chipsRow}>
            <View style={styles.chipNeutral}>
              <Ionicons name="card" size={14} color={MAROON} style={{ marginRight: 6 }} />
              <Text style={styles.chipNeutralText}>{method}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={SUBTLE} />
              <Text style={styles.metaText}>{paidAt}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.dottedDivider} />

          {/* Receipt details */}
          <View style={styles.detailsSheet}>
            <Text style={styles.sheetTitle}>Receipt Details</Text>
            <Row label="Payment ID" value={paymentId} mono />
            <Row label="Booking Reference" value={bookingRef} mono />
            <Row label="Package" value={packageName} />
          </View>
        </View>

        {/* Booking Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Information</Text>
          <Text style={styles.infoText}>
            Thank you for booking with us. A confirmation message will be sent shortly. Please keep
            this receipt for your records. For concerns, contact support with your{' '}
            <Text style={styles.highlight}>Booking Reference</Text>.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={() =>
            navigation.navigate('Book', {
              bookingId: bookingData?.bookingReference,
              bookingData: bookingData,
            })
          }
        >
          <Ionicons name="receipt-outline" size={18} color={MAROON} style={{ marginRight: 8 }} />
          <Text style={styles.btnGhostText}>View Booking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => navigation.navigate('Home')}
        >
          <Ionicons name="home" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnPrimaryText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/** Badge with maroon background + bold check */
const SuccessBadge = () => (
  <View style={styles.successBadgeWrap}>
    <View style={styles.badgeOuter}>
      <View style={styles.badgeInner}>
        <Ionicons name="checkmark" size={38} color="#fff" />
      </View>
    </View>
  </View>
);

/** Reusable row */
const Row = ({ label, value, mono = false }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={1}>
      {value ?? '—'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    backgroundColor: MAROON,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 12, android: 14 }),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 24 },

  bannerWrap: { alignItems: 'center', marginTop: 6, marginBottom: 22 },
  successBadgeWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: MAROON_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: MAROON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { marginTop: 12, fontSize: 20, fontWeight: '800', color: INK },
  successSubtitle: { marginTop: 4, fontSize: 13.5, color: SUBTLE },

  receiptCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: MAROON },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amountLabel: { color: SUBTLE, fontSize: 12.5, fontWeight: '600' },
  amountValue: { color: MAROON, fontSize: 26, fontWeight: '900' },
  chipsRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  chipNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipNeutralText: { color: MAROON, fontWeight: '800', fontSize: 12 },
  chipSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SUCCESS_BG,
    borderColor: SUCCESS_BORDER,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipSuccessText: { color: SUCCESS_DEEP, fontWeight: '900', fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: SUBTLE, fontSize: 12.5 },

  dottedDivider: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    borderBottomColor: HAIRLINE,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },

  detailsSheet: {
    backgroundColor: MUTED_BG,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  sheetTitle: { fontSize: 14, fontWeight: '800', color: INK, marginBottom: 6 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: INK, marginBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: HAIRLINE },
  rowLabel: { flex: 1, color: SUBTLE, fontSize: 13.5 },
  rowValue: { flex: 1, textAlign: 'right', color: INK, fontWeight: '800', fontSize: 13.5 },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 0.2 },

  infoText: { color: SUBTLE, fontSize: 13.5, lineHeight: 20 },
  highlight: { color: INK, fontWeight: '900' },

  footer: {
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopColor: HAIRLINE,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
  },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnGhost: { backgroundColor: CHIP_BG, borderWidth: 1, borderColor: CHIP_BORDER },
  btnGhostText: { color: MAROON, fontWeight: '900' },
  btnPrimary: { backgroundColor: MAROON },
  btnPrimaryText: { color: '#fff', fontWeight: '900' },
});

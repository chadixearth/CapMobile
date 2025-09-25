// src/screens/main/TouristRefundScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { listRefunds } from '../../services/Earnings/RefundService';

const { width: SCREEN_W } = Dimensions.get('window');

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';
const TEXT = '#1F1F1F';
const MUTED = '#6B6B6B';
const BORDER = '#ECECEC';

// Use backend status keys
const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  voided: '#64748B',
};

const PESO = (n = 0) =>
  `₱ ${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

function titleCase(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Map backend row → UI row
function mapRefundRow(r) {
  const rawStatus = (r.status || 'pending').toLowerCase();
  const amount = Number(r.refund_amount || 0);
  return {
    id: r.id,
    rawStatus,                       // for filtering/colors
    status: titleCase(rawStatus),    // for display
    bookingCode: r.booking_id || r.short_ref || '—',
    tourTitle: r.driver_name ? `Driver: ${r.driver_name}` : `Booking ${String(r.booking_id || '').slice(0, 8)}`,
    requestedAt: r.created_at,
    amountRequested: amount,
    amountRefunded: rawStatus === 'approved' ? amount : 0,
    method: '—',
    reason: r.reason || '',
    notes: r.remarks || '',
  };
}

export default function TouristRefundScreen({ navigation }) {
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allRefunds, setAllRefunds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      setFetching(true);
      // Pull a generous page to fill the screen; adjust if you need true pagination UI.
      const resp = await listRefunds({ page: 1, pageSize: 100, status: null });
      if (!resp.success) {
        Alert.alert('Refunds', resp.error || 'Failed to load refunds.');
        setAllRefunds([]);
      } else {
        setAllRefunds(resp.results.map(mapRefundRow));
      }
    } catch (e) {
      setAllRefunds([]);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Filters & aggregations (backend statuses)
  const statuses = ['All', 'pending', 'approved', 'rejected', 'voided'];

  const filteredRefunds = useMemo(() => {
    return statusFilter === 'All'
      ? allRefunds
      : allRefunds.filter((r) => r.rawStatus === statusFilter);
  }, [allRefunds, statusFilter]);

  const statusCounts = useMemo(() => {
    const base = { pending: 0, approved: 0, rejected: 0, voided: 0 };
    allRefunds.forEach((r) => (base[r.rawStatus] = (base[r.rawStatus] || 0) + 1));
    return base;
  }, [allRefunds]);

  const totals = useMemo(() => {
    let requested = 0;
    let refunded = 0;
    allRefunds.forEach((r) => {
      requested += Number(r.amountRequested || 0);
      // treated "approved" as refunded amount
      if (r.rawStatus === 'approved') refunded += Number(r.amountRequested || 0);
    });
    return { requested, refunded };
  }, [allRefunds]);

  // UI helpers
  const StatusChip = ({ value, active, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: MAROON, borderColor: MAROON }]}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>
        {value === 'All' ? 'All' : titleCase(value)}
      </Text>
    </TouchableOpacity>
  );

  const Badge = ({ rawStatus }) => (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${STATUS_COLORS[rawStatus]}22`, borderColor: `${STATUS_COLORS[rawStatus]}55` },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: STATUS_COLORS[rawStatus] }]} />
      <Text style={[styles.badgeText, { color: STATUS_COLORS[rawStatus] }]}>{titleCase(rawStatus)}</Text>
    </View>
  );

  const StatusDistributionBar = () => {
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;
    const segments = Object.entries(statusCounts).filter(([, c]) => c > 0);
    const usableWidth = SCREEN_W - 40; // padding compensation
    return (
      <View>
        <View style={styles.stackTrack}>
          {segments.map(([k, c]) => {
            const w = (c / total) * usableWidth;
            return (
              <View
                key={k}
                style={{
                  width: Math.max(w, 4),
                  height: '100%',
                  backgroundColor: STATUS_COLORS[k],
                  opacity: 0.9,
                }}
              />
            );
          })}
        </View>
        <View style={styles.legendWrap}>
          {Object.keys(statusCounts).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: STATUS_COLORS[k] }]} />
              <Text style={styles.legendText}>
                {titleCase(k)} ({statusCounts[k]})
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header with centered title overlay (keeps back arrow on left, not blocked) */}
      <View style={{ position: 'relative' }}>
        <TARTRACKHeader
          showBack
          onBackPress={() => navigation.goBack?.()}
          // Intentionally not passing title to avoid conflicting layouts inside TARTRACKHeader
          showMessage={false}
          showNotification
          onNotificationPress={() => navigation.navigate('Notification')}
          containerStyle={{ backgroundColor: MAROON }}
          headerStyle={{ backgroundColor: MAROON, borderBottomWidth: 0 }}
          tint="#fff"
        />
        {/* Centered title that doesn't capture touches */}
        <View pointerEvents="none" style={styles.headerCenterTitleWrap}>
          <Text style={styles.headerCenterTitle}>Refunds</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Requested</Text>
            <Text style={styles.kpiValue}>{PESO(totals.requested)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Refunded</Text>
            <Text style={styles.kpiValue}>{PESO(totals.refunded)}</Text>
          </View>
        </View>

        {/* Visualization: Status Distribution */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="pie-chart-outline" size={18} color={MAROON} />
              <Text style={styles.cardTitle}>Status Distribution</Text>
            </View>
          </View>
          <StatusDistributionBar />
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {statuses.map((s) => (
              <StatusChip
                key={s}
                value={s}
                active={statusFilter === s}
                onPress={() => setStatusFilter(s)}
              />
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <View style={[styles.card, { paddingVertical: 0 }]}>
          <View style={styles.listHeader}>
            <Ionicons name="refresh-circle" size={18} color={MAROON} />
            <Text style={styles.listHeaderText}>
              {statusFilter === 'All' ? 'All Refund Requests' : `${titleCase(statusFilter)} Refunds`}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.countPill}>{filteredRefunds.length}</Text>
          </View>

          {fetching ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8, color: MUTED, fontSize: 12 }}>Loading refunds…</Text>
            </View>
          ) : filteredRefunds.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: TEXT, fontWeight: '800', marginBottom: 4 }}>
                No refunds found
              </Text>
              <Text style={{ color: MUTED, fontSize: 12 }}>
                You don’t have refund requests
                {statusFilter !== 'All' ? ` in "${titleCase(statusFilter)}"` : ''}. If you need help,
                visit Help Center.
              </Text>
            </View>
          ) : (
            filteredRefunds.map((r, idx) => (
              <View
                key={r.id}
                style={[styles.refundRow, idx < filteredRefunds.length - 1 && styles.rowDivider]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Badge rawStatus={r.rawStatus} />
                    <View style={styles.priceCol}>
                      <Text style={styles.amountText}>{PESO(r.amountRequested)}</Text>
                      <Text style={styles.requestDateText}>{shortDate(r.requestedAt)}</Text>
                    </View>
                  </View>

                  <Text style={styles.tourText} numberOfLines={1}>
                    {r.tourTitle}
                  </Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="receipt-outline" size={14} color={MUTED} />
                    <Text style={styles.metaText}> {r.bookingCode}</Text>
                  </View>

                  {!!r.reason && (
                    <Text style={styles.reasonText} numberOfLines={2}>
                      {r.reason}
                    </Text>
                  )}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => setDetail(r)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={MAROON} />
                      <Text style={styles.ghostBtnText}>View details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="cash-outline" size={18} color={MAROON} />
                </View>
                <Text style={styles.modalTitle}>Refund Details</Text>
              </View>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

            {detail && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Badge rawStatus={detail.rawStatus} />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Booking</Text>
                  <Text style={styles.detailValue}>{detail.bookingCode}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Title</Text>
                  <Text style={styles.detailValue}>{detail.tourTitle}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Requested</Text>
                  <Text style={styles.detailValue}>{PESO(detail.amountRequested)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Refunded</Text>
                  <Text style={styles.detailValue}>{PESO(detail.amountRefunded)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Method</Text>
                  <Text style={styles.detailValue}>{detail.method || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Requested on</Text>
                  <Text style={styles.detailValue}>{shortDate(detail.requestedAt)}</Text>
                </View>

                {!!detail.reason && (
                  <View style={[styles.detailBlock, { marginTop: 10 }]}>
                    <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Reason</Text>
                    <Text style={[styles.detailValue, { color: TEXT }]}>{detail.reason}</Text>
                  </View>
                )}
                {!!detail.notes && (
                  <View style={[styles.detailBlock, { marginTop: 8 }]}>
                    <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Notes</Text>
                    <Text style={[styles.detailValue, { color: TEXT }]}>{detail.notes}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered title overlay for TARTRACKHeader
  headerCenterTitleWrap: {
    position: 'absolute',
    left: 56,   // keep clear of back button area
    right: 56,  // keep clear of right icons (e.g., notifications)
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: TEXT, fontWeight: '800', marginLeft: 6 },

  kpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  kpiLabel: { color: MUTED, fontSize: 12, fontWeight: '700' },
  kpiValue: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 2 },

  filters: { marginTop: 10, paddingHorizontal: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
    marginHorizontal: 4,
  },
  chipText: { color: TEXT, fontWeight: '700', fontSize: 12 },

  listHeader: {
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listHeaderText: { color: TEXT, fontWeight: '800' },
  countPill: {
    backgroundColor: '#F6F6F6',
    color: MUTED,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },

  refundRow: { paddingHorizontal: 8, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  priceCol: { marginLeft: 'auto', alignItems: 'flex-end' },
  amountText: { fontWeight: '900', color: TEXT },
  requestDateText: { color: MUTED, fontSize: 11, marginTop: 2 },

  tourText: { color: TEXT, fontWeight: '700', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { color: MUTED, fontSize: 12 },
  dotSep: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#CFCFCF', marginHorizontal: 8 },
  reasonText: { color: '#3F3F3F', fontSize: 12, marginTop: 6 },

  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F3DADA',
    backgroundColor: '#FFF7F7',
  },
  ghostBtnText: { color: MAROON, fontWeight: '800', fontSize: 12 },

  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  badgeText: { fontWeight: '800', fontSize: 12 },

  stackTrack: {
    height: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 6,
  },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: MUTED, fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 440,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDF2EF',
    borderWidth: 1,
    borderColor: '#F3DADA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalTitle: { color: TEXT, fontWeight: '800', marginLeft: 8 },
  modalBody: { padding: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' },
  detailLabel: { color: MUTED, fontSize: 12, fontWeight: '700' },
  detailValue: { color: TEXT, fontSize: 13, fontWeight: '700', maxWidth: '60%' },
  detailBlock: {},
});

//PAYOUT HISTORY MODAL
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrency, getDriverPayoutHistory } from '../services/Earnings/EarningsService';

const ACCENT = '#6B2E2B';
const BG = '#FAFAFA';
const CARD = '#FFFFFF';
const BORDER = '#EEE6E0';
const MUTED = '#6B7280';
const TEXT = '#1A1A1A';
const PH_TZ = 'Asia/Manila';

const ITEMS_PER_PAGE = 5;

export default function PayoutHistoryModal({ visible, onClose, driverId, preloadedData }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (!driverId) {
        setErrorText('Driver ID is required to load payout history.');
        setLoading(false);
        return;
      }
      if (preloadedData) {
        processPayoutData(preloadedData);
      } else {
        fetchPayouts();
      }
    }
  }, [visible, driverId, preloadedData]);

  useEffect(() => {
    if (loading) {
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
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.delay(600 - delay),
          ])
        );
      };
      
      pulse.start();
      createDotAnimation(dot1Anim, 0).start();
      createDotAnimation(dot2Anim, 200).start();
      createDotAnimation(dot3Anim, 400).start();
      
      return () => {
        pulse.stop();
        dot1Anim.stopAnimation();
        dot2Anim.stopAnimation();
        dot3Anim.stopAnimation();
      };
    }
  }, [loading, pulseAnim, dot1Anim, dot2Anim, dot3Anim]);

  const processPayoutData = (data) => {
    setLoading(false);
    setErrorText('');
    setCurrentPage(1);
    const rows = Array.isArray(data) ? data : [];
    // Filter to only show released payouts
    const releasedPayouts = rows.filter(payout => {
      const status = (payout?.status || '').toLowerCase();
      return status === 'completed' || status === 'released';
    });
    // newest first
    releasedPayouts.sort((a, b) => (new Date(b?.payout_date || 0)) - (new Date(a?.payout_date || 0)));
    setPayouts(releasedPayouts);
  };

  const fetchPayouts = async () => {
    if (!driverId) {
      setErrorText('Driver ID is required to load payout history.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setErrorText('');
    setCurrentPage(1);
    try {
      const result = await getDriverPayoutHistory(driverId);
      if (result.success) {
        processPayoutData(result.data);
      } else {
        setPayouts([]);
        setErrorText(result.error || 'Failed to load payouts.');
        setLoading(false);
      }
    } catch (err) {
      setPayouts([]);
      setErrorText('Failed to load payouts.');
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!driverId) return;
    setRefreshing(true);
    await fetchPayouts();
    setRefreshing(false);
  }, [driverId]);

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  const displayedPayouts = useMemo(() => {
    return payouts.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [payouts, currentPage]);

  const hasMore = payouts.length > displayedPayouts.length;

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-PH', {
        timeZone: PH_TZ,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const getStatusMeta = (statusRaw) => {
    const s = (statusRaw || '').toLowerCase();
    if (s === 'completed' || s === 'released') {
      return {
        label: 'Released',
        icon: 'check-circle',
        fg: '#1B5E20',
        bg: '#E8F5E9',
        br: '#C8E6C9',
        rail: '#9CCC65',
      };
    }
    if (s === 'pending') {
      return {
        label: 'Pending',
        icon: 'clock-outline',
        fg: '#8B6B1F',
        bg: '#FFF7E6',
        br: '#FCE3BF',
        rail: '#F6C26A',
      };
    }
    if (s === 'failed' || s === 'rejected') {
      return {
        label: 'Failed',
        icon: 'alert-circle',
        fg: '#B3261E',
        bg: '#FDECEA',
        br: '#F6C4C0',
        rail: '#EF9A9A',
      };
    }
    return {
      label: 'Unknown',
      icon: 'help-circle-outline',
      fg: '#475569',
      bg: '#F1F5F9',
      br: '#E2E8F0',
      rail: '#CBD5E1',
    };
  };

  // Group by Month Year (e.g., "Sep 2025")
  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of displayedPayouts) {
      const d = p?.payout_date ? new Date(p.payout_date) : null;
      const key = d
        ? d.toLocaleDateString('en-PH', { timeZone: PH_TZ, month: 'long', year: 'numeric' })
        : 'Unknown Date';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return Array.from(map.entries()); // [ [sectionTitle, items[]], ... ]
  }, [displayedPayouts]);

  // Summary: totals
  const summary = useMemo(() => {
    let totalReleased = 0, totalPending = 0, count = payouts.length;
    for (const p of payouts) {
      const amt = Number(p?.amount || 0);
      const st = (p?.status || '').toLowerCase();
      if (st === 'completed' || st === 'released') totalReleased += amt;
      else if (st === 'pending') totalPending += amt;
    }
    return { totalReleased, totalPending, count };
  }, [payouts]);

  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.handleBar} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.title}>Payout History</Text>
          <Text style={styles.subtitle}>Your earnings withdrawals</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={onClose} accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={MUTED} />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryCell}>
          <View style={[styles.dot, { backgroundColor: ACCENT }]} />
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{summary.count}</Text>
        </View>
        <View style={styles.vSep} />
        <View style={styles.summaryCell}>
          <View style={[styles.dot, { backgroundColor: '#1B5E20' }]} />
          <Text style={styles.summaryLabel}>Released</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalReleased)}</Text>
        </View>
        <View style={styles.vSep} />
        {/* <View style={styles.summaryCell}>
          <View style={[styles.dot, { backgroundColor: '#8B6B1F' }]} />
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalPending)}</Text>
        </View> */}

        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} accessibilityLabel="Refresh">
          <Ionicons name="refresh" size={16} color={ACCENT} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
        <Header />

        {loading ? (
          <View style={styles.loading}>
            <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
              <Image 
                source={require('../../assets/TarTrack Logo_sakto.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <View style={styles.loadingTextContainer}>
              <Text style={styles.loadingTextBase}>Loading payouts</Text>
              <Animated.Text style={[styles.dot, { opacity: dot1Anim }]}>.</Animated.Text>
              <Animated.Text style={[styles.dot, { opacity: dot2Anim }]}>.</Animated.Text>
              <Animated.Text style={[styles.dot, { opacity: dot3Anim }]}>.</Animated.Text>
            </View>
          </View>
        ) : errorText ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color="#B3261E" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : payouts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="wallet-outline" size={44} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No payouts yet</Text>
            <Text style={styles.emptySub}>
              Your payout history will appear here once you start receiving payments.
            </Text>
            <TouchableOpacity onPress={onRefresh} style={styles.ctaBtn}>
              <Ionicons name="sparkles-outline" size={16} color="#fff" />
              <Text style={styles.ctaText}>Check again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={null /* use the header refresh button for simple UI */}
          >
            {grouped.map(([monthTitle, items], sIdx) => (
              <View key={monthTitle + sIdx} style={{ marginBottom: 18 }}>
                {/* Section header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{monthTitle}</Text>
                  <View style={styles.sectionRule} />
                </View>

                {/* Timeline rail */}
                <View style={styles.timelineRow}>
                  <View style={styles.rail} />
                  <View style={{ flex: 1 }}>
                    {items.map((payout, idx) => {
                      const meta = getStatusMeta(payout?.status);
                      return (
                        <View
                          key={payout?.id || idx}
                          style={[styles.card, { marginTop: idx === 0 ? 0 : 12 }]}
                        >
                          {/* status dot that sits on the rail */}
                          <View style={[styles.railDotWrap]}>
                            <View style={[styles.railDot, { borderColor: meta.rail, backgroundColor: '#fff' }]} />
                          </View>

                          <View style={styles.cardHead}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <MaterialCommunityIcons name="cash-minus" size={18} color={ACCENT} />
                              <Text style={styles.amount} numberOfLines={1}>
                                {formatCurrency(payout?.amount || 0)}
                              </Text>
                            </View>

                            <View style={[styles.pill, { backgroundColor: meta.bg, borderColor: meta.br }]}>
                              <MaterialCommunityIcons name={meta.icon} size={14} color={meta.fg} />
                              <Text style={[styles.pillText, { color: meta.fg }]}>{meta.label}</Text>
                            </View>
                          </View>

                          <Text style={styles.dateText}>{fmtDate(payout?.payout_date)}</Text>

                          {!!payout?.reference_number && (
                            <View style={styles.metaRow}>
                              <Text style={styles.metaKey}>Ref</Text>
                              <Text style={styles.metaVal} numberOfLines={1} ellipsizeMode="middle">
                                {payout.reference_number}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            ))}
            
            {hasMore && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                <Ionicons name="chevron-down" size={16} color={ACCENT} />
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    height: '95%',
    backgroundColor: BG,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  headerWrap: {
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleBar: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 12,
  },
  headerRow: {
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '800', color: TEXT, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#EFEFEF',
  },

  summaryStrip: {
    marginTop: 4,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FCFCFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1EFEA',
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCell: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  summaryLabel: { color: MUTED, fontSize: 12, marginRight: 6 },
  summaryValue: { color: TEXT, fontWeight: '800', fontSize: 12 },
  vSep: { width: 1, height: 18, backgroundColor: '#EEE', marginHorizontal: 6 },
  refreshBtn: {
    marginLeft: 'auto',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: '#EDEDED', backgroundColor: '#FFFFFF',
  },
  refreshText: { marginLeft: 6, color: ACCENT, fontWeight: '700', fontSize: 12 },

  loading: { 
    flex: 1, 
    backgroundColor: CARD, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  logoContainer: { alignItems: 'center', justifyContent: 'center', marginTop: -100 },
  logo: { width: 200, height: 200 },
  loadingTextContainer: {
    marginTop: -75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTextBase: {
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dot: {
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
  }, 

  errorBox: {
    margin: 16,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#FDECEA', borderColor: '#F6C4C0', borderWidth: 1, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  errorText: { color: '#B3261E', fontSize: 12, fontWeight: '600' },

  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { color: '#374151', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionRule: { height: 1, backgroundColor: '#EEE', flex: 1, marginLeft: 8, borderRadius: 1 },

  timelineRow: { flexDirection: 'row' },
  rail: { width: 10, marginLeft: 12, marginRight: 12, borderRightWidth: 2, borderRightColor: '#EFE7E3' },
  railDotWrap: { position: 'absolute', left: -26, top: 14, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  railDot: { width: 10, height: 10, borderRadius: 6, borderWidth: 3 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  amount: { marginLeft: 8, color: TEXT, fontWeight: '900', fontSize: 18, letterSpacing: 0.2 },

  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillText: { marginLeft: 6, fontWeight: '800', fontSize: 11 },

  dateText: { color: MUTED, fontSize: 12, marginTop: 2, marginBottom: 6, fontWeight: '600' },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaKey: { color: MUTED, fontSize: 11, width: 32 },
  metaVal: { color: '#111827', fontSize: 12, fontFamily: 'monospace', flexShrink: 1 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyIcon: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#F8F9FA',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#EFEFEF',
  },
  emptyTitle: { color: TEXT, fontWeight: '800', fontSize: 18, marginBottom: 6 },
  emptySub: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 12 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 6 },

  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  loadMoreText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
});

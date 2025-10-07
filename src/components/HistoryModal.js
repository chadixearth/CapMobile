// components/HistoryModal.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../styles/global';

const { height: screenHeight } = Dimensions.get('window');

function formatPeso(n) {
  const num = Number(n || 0);
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toShortDate(iso, timeZone = 'Asia/Manila') {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function periodLabel(startIso, endIso, timeZone = 'Asia/Manila') {
  if (!startIso && !endIso) return '—';
  const s = toShortDate(startIso, timeZone);
  const e = toShortDate(endIso, timeZone);
  return s === e ? s : `${s} — ${e}`;
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

export default function HistoryModal({
  visible,
  onClose,
  historyItems,
  historyLoading,
  historyError,
  hasMoreHistory,
  onLoadMore,
  onPickHistory,
  selectedHistory,
  historyMode,
  setHistoryMode,
  pulseAnim,
}) {
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      backdropAnim.setValue(0);
    }
  }, [visible, backdropAnim]);

  const cardTranslate = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });
  const cardScale = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });
  const cardOpacity = backdropAnim;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View
        style={[
          styles.modalCard,
          { opacity: cardOpacity, transform: [{ translateY: cardTranslate }, { scale: cardScale }] },
        ]}
      >
        <View style={styles.modalHeader}>
          {historyMode === 'list' ? (
            <>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconWrap}>
                  <MaterialCommunityIcons name="chart-areaspline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Breakeven & Profit History</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setHistoryMode('list')}
                style={[styles.iconBtn, styles.iconBtnGhost]}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {historyMode === 'list' && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator>
            {historyLoading && historyItems.length === 0 ? (
              <View style={styles.historyLoadingContainer}>
                <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
                  <Image
                    source={require('../../assets/TarTrack Logo_sakto.png')}
                    style={styles.historyLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.loadingNote}>Fetching your latest periods…</Text>
                </Animated.View>
              </View>
            ) : historyError ? (
              <View style={styles.bannerError}>
                <Ionicons name="alert-circle" size={16} color="#B3261E" />
                <Text style={styles.bannerText}>{historyError}</Text>
              </View>
            ) : historyItems.length === 0 ? (
              <View style={styles.bannerNeutral}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.bannerText}>No history yet.</Text>
              </View>
            ) : (
              <>
                {historyItems.map((h, idx) => {
                  const sm = statusMeta(h);
                  return (
                    <TouchableOpacity
                      key={h.id || idx}
                      style={[styles.historyRow, idx < historyItems.length - 1 && styles.feedDivider]}
                      onPress={() => onPickHistory(h)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyTitle}>{periodLabel(h.period_start, h.period_end)}</Text>
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
                })}

                {hasMoreHistory && historyItems.length > 5 && (
                  <TouchableOpacity
                    onPress={onLoadMore}
                    style={styles.loadMoreBtn}
                    disabled={historyLoading}
                    activeOpacity={0.7}
                  >
                    {historyLoading ? (
                      <Animated.View style={{ opacity: pulseAnim }}>
                        <Image
                          source={require('../../assets/TarTrack Logo_sakto.png')}
                          style={styles.loadMoreLogo}
                          resizeMode="contain"
                        />
                      </Animated.View>
                    ) : (
                      <>
                        <Ionicons name="chevron-down" size={16} color={colors.primary} />
                        <Text style={styles.loadMoreText}>Load more</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        )}

        {historyMode === 'detail' && selectedHistory && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator>
            {/* Header / Period */}
            <View style={styles.detailHeaderBlock}>
              <View style={styles.detailHeaderRow}>
                <View style={styles.dateBadge}>
                  <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                  <Text style={styles.detailDate}>
                    {periodLabel(selectedHistory.period_start, selectedHistory.period_end)}
                  </Text>
                </View>

                {(() => {
                  const sm = statusMeta(selectedHistory);
                  return (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: sm.bg, borderColor: sm.bg },
                      ]}
                    >
                      <MaterialCommunityIcons name={sm.icon} size={16} color={sm.fg} />
                      <Text style={[styles.statusPillText, { color: sm.fg }]}>{sm.label}</Text>
                    </View>
                  );
                })()}
              </View>
            </View>

            {/* Metric Tiles */}
            <View style={styles.tilesGrid}>
              <MetricTile
                icon={<MaterialCommunityIcons name="cash-multiple" size={18} color={colors.primary} />}
                label="Revenue (driver)"
                value={`₱ ${formatPeso(selectedHistory.revenue_driver)}`}
              />
              <MetricTile
                icon={<MaterialCommunityIcons name="receipt" size={18} color={colors.primary} />}
                label="Expenses"
                value={`₱ ${formatPeso(selectedHistory.expenses)}`}
              />
              <MetricTile
                icon={<MaterialCommunityIcons name="trending-up" size={18} color={colors.primary} />}
                label="Profit"
                value={`₱ ${formatPeso(selectedHistory.profit)}`}
                highlight
              />
              <MetricTile
                icon={<MaterialCommunityIcons name="car-estate" size={18} color={colors.primary} />}
                label="Rides"
                value={`${selectedHistory.rides_done}/${selectedHistory.rides_needed}`}
              />
            </View>

            {/* Rides Progress */}
            <View style={styles.progressCard}>
              <View style={styles.progressHead}>
                <View style={styles.progressIconWrap}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.progressTitle}>Breakeven Progress</Text>
              </View>
              <ProgressBar
                done={Number(selectedHistory.rides_done || 0)}
                need={Number(selectedHistory.rides_needed || 0)}
              />
              <Text style={styles.progressNote}>
                {Number(selectedHistory.rides_needed || 0) === 0
                  ? 'No target rides configured'
                  : `${Math.min(
                      100,
                      Math.round(
                        ((Number(selectedHistory.rides_done || 0) / Number(selectedHistory.rides_needed || 1)) || 0) * 100
                      )
                    )}% toward your target`}
              </Text>
            </View>

            {/* Breakdown */}
            <View style={styles.detailSection}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionIconWrap}>
                  <MaterialCommunityIcons name="chart-pie" size={16} color={colors.primary} />
                </View>
                <Text style={styles.detailSectionTitle}>Breakdown</Text>
              </View>

              <View style={styles.breakdownCard}>
                <View style={styles.breakRow}>
                  <View style={styles.breakLeft}>
                    <View style={[styles.dot, { backgroundColor: 'rgba(16,185,129,0.25)' }]} />
                    <Text style={styles.mixLabel}>Standard rides (80%)</Text>
                  </View>
                  <Text style={styles.mixValue}>₱ {formatPeso(selectedHistory?.breakdown?.standard_share || 0)}</Text>
                </View>

                <View style={[styles.breakRow, styles.feedDivider]}>
                  <View style={styles.breakLeft}>
                    <View style={[styles.dot, { backgroundColor: 'rgba(59,130,246,0.25)' }]} />
                    <Text style={styles.mixLabel}>Custom tours (100%)</Text>
                  </View>
                  <Text style={styles.mixValue}>₱ {formatPeso(selectedHistory?.breakdown?.custom_share || 0)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

/* ---------- Small presentational subcomponents (no logic change) ---------- */
function MetricTile({ icon, label, value, highlight }) {
  return (
    <View style={[styles.tile, highlight && styles.tileHighlight]}>
      <View style={styles.tileIconWrap}>{icon}</View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, highlight && styles.tileValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ProgressBar({ done, need }) {
  const pct = !need ? 0 : Math.max(0, Math.min(100, Math.round((done / need) * 100)));
  return (
    <View style={styles.progressOuter}>
      <View style={[styles.progressInner, { width: `${pct}%` }]} />
    </View>
  );
}

/* -------------------------------- Styles -------------------------------- */
const CARD_BG = 'rgba(255, 255, 255, 1)';
const BORDER = 'rgba(15,23,42,0.06)';

const styles = StyleSheet.create({
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  modalCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: Math.max(24, screenHeight * 0.08),
    maxHeight: screenHeight * 0.8,
    padding: 14,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  modalContent: { marginTop: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(103,80,164,0.08)', marginRight: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  iconBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(103,80,164,0.18)',
  },

  /* list */
  historyRow: {
    paddingVertical: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  historyLeft: { paddingRight: 12, flex: 1 },
  historyTitle: { color: colors.text, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  historySub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  historySubSmall: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  statusPillText: { fontWeight: '800', fontSize: 11, marginLeft: 6, letterSpacing: 0.2 },

  /* detail header */
  detailHeaderBlock: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  detailHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.03)',
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 10, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  detailDate: { color: colors.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },

  /* tiles */
  tilesGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    backgroundColor: 'rgba(250,250,250,0.8)',
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  tileHighlight: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.18)',
  },
  tileIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.04)', marginBottom: 8,
  },
  tileLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
  tileValue: { color: colors.text, fontSize: 15, fontWeight: '900' },
  tileValueHighlight: { color: colors.text },

  /* progress */
  progressCard: {
    marginTop: 12,
    backgroundColor: 'rgba(250,250,250,0.9)',
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  progressIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  progressTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  progressOuter: {
    height: 10,
    backgroundColor: 'rgba(15,23,42,0.06)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressInner: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressNote: { marginTop: 8, color: colors.textSecondary, fontSize: 12 },

  /* section & breakdown */
  detailSection: { marginTop: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.04)',
  },
  detailSectionTitle: { color: colors.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },

  breakdownCard: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: 'rgba(250,250,250,0.7)',
    overflow: 'hidden',
  },
  breakRow: {
    paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  breakLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  mixLabel: { color: colors.text, fontWeight: '700', fontSize: 13, flexWrap: 'wrap' },
  mixValue: { color: colors.text, fontSize: 15, fontWeight: '900' },

  /* banners & misc */
  bannerError: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: '#FDECEA', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#f3d0cc',
    marginBottom: 8,
  },
  bannerNeutral: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: 'rgba(15,23,42,0.03)', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    marginBottom: 8,
  },
  bannerText: { marginLeft: 8, color: colors.text, fontSize: 12 },

  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: 10, borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.03)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  loadMoreText: { color: colors.primary, fontWeight: '700', fontSize: 13, marginLeft: 6, letterSpacing: 0.2 },

  feedDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },

  historyLoadingContainer: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  logoContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 4, gap: 8 },
  historyLogo: { width: 120, height: 120 },
  loadMoreLogo: { width: 24, height: 24 },
  loadingNote: { fontSize: 12, color: colors.textSecondary },
});

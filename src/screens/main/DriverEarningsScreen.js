import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';
import {
  getDriverEarningsStats,
  getEarningsPercentageChange,
  formatCurrency,
  formatPercentage,
  getDriverEarnings,
} from '../../services/Earnings/EarningsService';

const { width } = Dimensions.get('window');

/* ----------------------------- Local date helpers ----------------------------- */
function toLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeekMonday(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = d.getDay(); // 0 Sun .. 6 Sat
  const offset = (dow + 6) % 7; // 0 if Mon, 6 if Sun
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeekExclusive(base = new Date()) {
  const start = startOfWeekMonday(base);
  return addDays(start, 7); // next Monday (exclusive)
}
function startOfMonth(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth(), 1);
}
function startOfNextMonth(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth() + 1, 1);
}
function formatSingleDate(ymd) {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatRangeDisplay(fromYMD, toYMD) {
  if (!fromYMD || !toYMD) return '';
  const f = new Date(fromYMD + 'T00:00:00');
  const t = new Date(toYMD + 'T00:00:00');
  const sameYear = f.getFullYear() === t.getFullYear();
  const sameMonth = sameYear && f.getMonth() === t.getMonth();
  const fmt = (d, withYear = true) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });

  if (sameMonth) {
    return `${f.toLocaleString('en-US', { month: 'short' })} ${f.getDate()}–${t.getDate()}, ${t.getFullYear()}`;
  }
  if (sameYear) {
    return `${fmt(f, false)} – ${fmt(t)}`;
  }
  return `${fmt(f)} – ${fmt(t)}`;
}

/* -------------------------------- Component -------------------------------- */
export default function DriverEarningsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [earningsData, setEarningsData] = useState(null);
  const [detailedEarnings, setDetailedEarnings] = useState([]);
  const [percentageChange, setPercentageChange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // 'today', 'week', 'month', 'all'

  useEffect(() => {
    fetchUserAndEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const fetchUserAndEarnings = async () => {
    try {
      setLoading(true);

      // Get current user
      let currentUser = await getCurrentUser();
      let userId = null;

      if (currentUser) {
        setUser(currentUser);
        userId = currentUser.id;
      } else {
        // Fallback to Supabase
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          Alert.alert('Error', 'Please log in to view earnings');
          navigation.goBack();
          return;
        }

        setUser(user);
        userId = user.id;
      }

      if (userId) {
        await Promise.all([
          fetchEarningsData(userId),
          fetchDetailedEarnings(userId),
          fetchPercentageChange(userId),
        ]);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
      Alert.alert('Error', `Failed to load earnings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarningsData = async (driverId) => {
    try {
      const data = await getDriverEarningsStats(driverId, selectedPeriod);
      if (data.success) {
        setEarningsData(data.data);
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    }
  };

  const fetchDetailedEarnings = async (driverId) => {
    try {
      const filters = getDateFilters(selectedPeriod);
      const data = await getDriverEarnings(driverId, filters);
      if (data.success) {
        setDetailedEarnings(data.data.earnings || []);
      }
    } catch (error) {
      console.error('Error fetching detailed earnings:', error);
    }
  };

  const fetchPercentageChange = async (driverId) => {
    try {
      const data = await getEarningsPercentageChange(
        driverId,
        selectedPeriod === 'week' ? 'week' : 'month'
      );
      if (data.success) {
        setPercentageChange(data.data);
      }
    } catch (error) {
      console.error('Error fetching percentage change:', error);
    }
  };

  /** Build filters for list view. */
  const getDateFilters = (period) => {
    const now = new Date();
    const filters = {};

    switch (period) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today 00:00
        const endExcl = addDays(start, 1); // tomorrow 00:00 (exclusive)
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
      case 'week': {
        // Explicit Monday → next Monday (exclusive)
        const start = startOfWeekMonday(now);      // Mon 00:00
        const endExcl = endOfWeekExclusive(now);   // next Mon 00:00 (exclusive)
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
      case 'month': {
        // Calendar month: 1st → 1st of next month (exclusive)
        const start = startOfMonth(now);
        const endExcl = startOfNextMonth(now);
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
      // 'all' => no date filter
    }

    return filters;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndEarnings();
    setRefreshing(false);
  };

  /** Sum visible list for consistency (used for Today/Week cards). */
  const visibleTotal = detailedEarnings.reduce(
    (sum, e) => sum + (Number(e?.driver_earnings) || 0),
    0
  );
  const visibleCount = detailedEarnings.length;
  const visibleAvg = visibleCount > 0 ? visibleTotal / visibleCount : 0;

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {['today', 'week', 'month', 'all'].map((period) => (
        <TouchableOpacity
          key={period}
          style={[styles.periodButton, selectedPeriod === period && styles.activePeriodButton]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.activePeriodButtonText,
            ]}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /** Always show a date line for today/week/month.
   *  Uses earningsData.period_from/to when available, else local fallback. */
  const renderRangeLine = () => {
    const pf = earningsData?.period_from;
    const pt = earningsData?.period_to;

    if (selectedPeriod === 'today') {
      const label = pf && pt ? formatSingleDate(pf) : formatSingleDate(toLocalYMD(new Date()));
      return <Text style={styles.rangeText}>{label}</Text>;
    }

    if (selectedPeriod === 'week') {
      if (pf && pt) return <Text style={styles.rangeText}>{formatRangeDisplay(pf, pt)}</Text>;
      const start = startOfWeekMonday(new Date());
      const endIncl = addDays(endOfWeekExclusive(new Date()), -1);
      return (
        <Text style={styles.rangeText}>
          {formatRangeDisplay(toLocalYMD(start), toLocalYMD(endIncl))}
        </Text>
      );
    }

    if (selectedPeriod === 'month') {
      if (pf && pt) return <Text style={styles.rangeText}>{formatRangeDisplay(pf, pt)}</Text>;
      const start = startOfMonth(new Date());
      const endIncl = addDays(startOfNextMonth(new Date()), -1);
      return (
        <Text style={styles.rangeText}>
          {formatRangeDisplay(toLocalYMD(start), toLocalYMD(endIncl))}
        </Text>
      );
    }

    return null; // 'all'
  };

  /** ------ Overview Card ------ */
  const renderEarningsOverview = () => {
    const useVisible = selectedPeriod === 'week' || selectedPeriod === 'today';
    const totalEarnings = useVisible
      ? visibleTotal
      : (earningsData?.total_driver_earnings || 0);

    const totalBookings = useVisible
      ? visibleCount
      : (earningsData?.count || 0);

    const avgEarning = useVisible
      ? visibleAvg
      : (earningsData?.avg_earning_per_booking || 0);

    const changeData = percentageChange || { percentage_change: 0, is_increase: true };
    const yourShare = earningsData?.driver_percentage ?? 80;

    const periodTitle =
      selectedPeriod === 'today'
        ? 'Daily Income'
        : selectedPeriod === 'week'
        ? 'Weekly Income'
        : selectedPeriod === 'month'
        ? 'Monthly Income'
        : 'All-time Income';

    const subText =
      selectedPeriod === 'today'
        ? (visibleTotal || 0) > 0
          ? `Today: ${formatCurrency(visibleTotal)}`
          : 'No earnings yet today'
        : `${totalBookings} completed · ${formatCurrency(avgEarning)} avg/booking`;

    return (
      <View style={styles.overviewCard}>
        {/* Top row: title + date range + trend chip */}
        <View style={styles.incomeTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.incomeTitle}>{periodTitle}</Text>
            {renderRangeLine()}
          </View>
          <View
            style={[
              styles.trendChip,
              { backgroundColor: changeData.is_increase ? '#EAF7EE' : '#FDEEEE' },
            ]}
          >
            <Ionicons
              name={changeData.is_increase ? 'trending-up-outline' : 'trending-down-outline'}
              size={14}
              color={changeData.is_increase ? '#2E7D32' : '#C62828'}
            />
            <Text
              style={[
                styles.trendText,
                { color: changeData.is_increase ? '#2E7D32' : '#C62828' },
              ]}
            >
              {changeData.is_increase ? '+' : '-'}
              {formatPercentage(changeData.percentage_change)}
            </Text>
          </View>
        </View>

        {/* Main row: big number + subtext */}
        <View style={styles.incomeMainRow}>
          <View style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text style={styles.incomeAmount}>{formatCurrency(totalEarnings)}</Text>
                <Text style={styles.incomeSub}>{subText}</Text>
              </>
            )}
          </View>
        </View>

        {/* Split stats */}
        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Your share</Text>
            <Text style={styles.splitValue}>{yourShare}%</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Completed</Text>
            <Text style={styles.splitValue}>{totalBookings}</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Avg / booking</Text>
            <Text style={styles.splitValue}>{formatCurrency(avgEarning)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEarningsList = () => (
    <View style={styles.earningsListContainer}>
      <Text style={styles.listTitle}>Earnings History</Text>

      {detailedEarnings.length > 0 ? (
        detailedEarnings.map((earning, index) => (
          <View key={earning.booking_id || index} style={styles.earningItem}>
            <View style={styles.earningIcon}>
              <MaterialCommunityIcons name="cash" size={24} color="#2ecc71" />
            </View>

            <View style={styles.earningDetails}>
              <Text style={styles.earningPackage}>
                {earning.package_name || 'Tour Package'}
              </Text>
              <Text style={styles.earningDate}>
                {new Date(earning.earning_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.earningBookingRef}>
                Booking ID: {String(earning.booking_id).slice(0, 8)}...
              </Text>
            </View>

            <View style={styles.earningAmounts}>
              <Text style={styles.driverEarning}>
                {formatCurrency(earning.driver_earnings)}
              </Text>
              <Text style={styles.listTotalText}>
                of {formatCurrency(earning.total_amount)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No earnings found</Text>
          <Text style={styles.emptyStateSubtext}>
            Complete tour bookings to start earning
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#6B2E2B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {renderPeriodSelector()}
        {renderEarningsOverview()}
        {renderEarningsList()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  /* Period selector */
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activePeriodButton: {
    backgroundColor: '#6B2E2B',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activePeriodButtonText: {
    color: '#fff',
  },

  /* Overview (income card) */
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  incomeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incomeTitle: { color: '#222', fontWeight: '800', fontSize: 14 },
  rangeText: { color: '#666', fontSize: 12, marginTop: 2 },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  trendText: { fontWeight: '800', fontSize: 12 },
  incomeMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  incomeAmount: { fontSize: 28, fontWeight: '900', color: '#222', letterSpacing: 0.2 },
  incomeSub: { color: '#777', marginTop: 2, fontSize: 12 },

  /* Split stats row */
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 12,
  },
  vDivider: { width: 1, height: 24, backgroundColor: '#EAEAEA' },
  splitCol: { flex: 1, alignItems: 'center' },
  splitLabel: { color: '#777', fontSize: 11, marginBottom: 2 },
  splitValue: { color: '#222', fontSize: 13, fontWeight: '800' },

  /* Earnings list */
  earningsListContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  earningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  earningIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  earningDetails: {
    flex: 1,
  },
  earningPackage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  earningDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  earningBookingRef: {
    fontSize: 11,
    color: '#999',
  },
  earningAmounts: {
    alignItems: 'flex-end',
  },
  driverEarning: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 2,
  },
  listTotalText: {
    fontSize: 12,
    color: '#666',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

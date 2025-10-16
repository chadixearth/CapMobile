// EARNINGS SCREEN

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Image,
  Animated,
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
import CalendarModal from '../../components/CalendarModal';
import YearPicker from '../../components/YearPicker';
import PayoutHistoryModal from '../../components/PayoutHistoryModal';

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
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'today', 'week', 'month', 'all'
  const [showCalendar, setShowCalendar] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPayoutHistory, setShowPayoutHistory] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchUserAndEarnings();
  }, [selectedPeriod, customDateRange]);

  useEffect(() => {
    fetchUserAndEarnings(true);
  }, []);

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

  const fetchUserAndEarnings = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      // Get current user (cached)
      let currentUser = user || await getCurrentUser();
      let userId = null;

      if (currentUser) {
        if (!user) setUser(currentUser);
        userId = currentUser.id;
      } else {
        const {
          data: { user: supabaseUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !supabaseUser) {
          Alert.alert('Error', 'Please log in to view earnings');
          navigation.goBack();
          return;
        }

        setUser(supabaseUser);
        userId = supabaseUser.id;
      }

      if (userId) {
        await Promise.all([fetchEarningsData(userId), fetchDetailedEarnings(userId)]);
        fetchPercentageChange(userId); // can run after
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
      Alert.alert('Error', `Failed to load earnings: ${error.message}`);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [user, selectedPeriod, customDateRange]);

  const fetchEarningsData = useCallback(async (driverId) => {
    try {
      const data = await getDriverEarningsStats(driverId, selectedPeriod, customDateRange);
      if (data.success) {
        setEarningsData(data.data);
      }
      return data;
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      return null;
    }
  }, [selectedPeriod, customDateRange]);

  const getDateFilters = useCallback((period) => {
    const filters = {};

    // FIX: Only use custom range if both from & to exist
    if (customDateRange?.from && customDateRange?.to) {
      filters.date_from = customDateRange.from;
      const endDate = new Date(customDateRange.to);
      endDate.setDate(endDate.getDate() + 1); // exclusive upper bound
      filters.date_to = toLocalYMD(endDate);
      return filters;
    }

    const now = new Date();

    switch (period) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today 00:00
        const endExcl = addDays(start, 1); // tomorrow 00:00 (exclusive)
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
      case 'week': {
        const start = startOfWeekMonday(now);      // Mon 00:00
        const endExcl = endOfWeekExclusive(now);   // next Mon 00:00
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
      case 'month': {
        const start = startOfMonth(now);           // 1st 00:00
        const endExcl = startOfNextMonth(now);     // next 1st 00:00
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
      case 'all': {
        const start = new Date(now.getFullYear(), 0, 1); // Jan 1st current year
        const endExcl = new Date(now.getFullYear() + 1, 0, 1); // Jan 1st next year
        filters.date_from = toLocalYMD(start);
        filters.date_to = toLocalYMD(endExcl);
        break;
      }
    }

    return filters;
  }, [customDateRange]);

  const fetchDetailedEarnings = useCallback(async (driverId) => {
    try {
      const filters = getDateFilters(selectedPeriod);
      const data = await getDriverEarnings(driverId, filters);
      if (data.success) {
        setDetailedEarnings(data.data.earnings || []);
      }
      return data;
    } catch (error) {
      console.error('Error fetching detailed earnings:', error);
      return null;
    }
  }, [selectedPeriod, getDateFilters]);

  const fetchPercentageChange = useCallback(async (driverId) => {
    try {
      const data = await getEarningsPercentageChange(
        driverId,
        selectedPeriod === 'week' ? 'week' : 'month'
      );
      if (data.success) {
        setPercentageChange(data.data);
      }
      return data;
    } catch (error) {
      console.error('Error fetching percentage change:', error);
      return null;
    }
  }, [selectedPeriod]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserAndEarnings(false);
    setRefreshing(false);
  }, [fetchUserAndEarnings]);

  const { visibleTotal, visibleCount, visibleAvg } = useMemo(() => {
    const total = detailedEarnings.reduce(
      (sum, e) => sum + (Number(e?.driver_earnings) || 0),
      0
    );
    const count = detailedEarnings.length;
    const avg = count > 0 ? total / count : 0;
    return { visibleTotal: total, visibleCount: count, visibleAvg: avg };
  }, [detailedEarnings]);

  const handlePeriodChange = useCallback((period) => {
    setSelectedPeriod(period);
    setCustomDateRange(null);
    setSelectedDate(null);
  }, []);

  const handleResetCustomDate = useCallback(() => {
    setCustomDateRange(null);
    setSelectedDate(null);
  }, []);

  const handleCalendarOpen = useCallback(() => {
    if (selectedPeriod === 'all') {
      setShowYearPicker(true);
    } else {
      setShowCalendar(true);
    }
  }, [selectedPeriod]);

  const handleDateSelect = useCallback((fromDate, toDate) => {
    setCustomDateRange({ from: fromDate, to: toDate });
    setSelectedDate(fromDate);
    setShowCalendar(false);
  }, []);

  const renderPeriodSelector = () => (
    <View style={styles.periodSelectorContainer}>
      <View style={styles.periodSelector}>
        {['today', 'week', 'month', 'all'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.activePeriodButton]}
            onPress={() => handlePeriodChange(period)}
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
      
      <View style={styles.calendarControls}>
        <TouchableOpacity 
          style={[styles.calendarButton, customDateRange && styles.calendarButtonActive]} 
          onPress={handleCalendarOpen}
        >
          <Ionicons 
            name={customDateRange ? "calendar" : "calendar-outline"} 
            size={20} 
            color={customDateRange ? "#fff" : "#6B2E2B"} 
          />
        </TouchableOpacity>
        
        {customDateRange && (
          <TouchableOpacity 
            style={styles.resetButton} 
            onPress={handleResetCustomDate}
          >
            <Ionicons name="refresh-outline" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  /** Always show a date line for today/week/month.
   *  Uses earningsData.period_from/to when available, else local fallback. */
  const renderRangeLine = () => {
    // Use custom date range if available
    if (customDateRange?.from && customDateRange?.to) {
      if (selectedPeriod === 'today') {
        return <Text style={styles.rangeText}>{formatSingleDate(customDateRange.from)}</Text>;
      }
      return <Text style={styles.rangeText}>{formatRangeDisplay(customDateRange.from, customDateRange.to)}</Text>;
    }

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

    if (selectedPeriod === 'all') {
      const currentYear = customDateRange ? new Date(customDateRange.from).getFullYear() : new Date().getFullYear();
      return (
        <View>
          <Text style={styles.rangeText}>{currentYear}</Text>
          <Text style={styles.rangeText}>Jan - Dec</Text>
        </View>
      );
    }

    return null;
  };

  /** ------ Overview Card ------ */
  const renderEarningsOverview = () => {
    // Prefer backend stats; fall back to visible list math
    const totalEarnings = earningsData?.total_driver_earnings ?? visibleTotal ?? 0;
    const totalBookings = earningsData?.count ?? visibleCount ?? 0;
    const avgEarning = earningsData?.avg_earning_per_booking ?? visibleAvg ?? 0;

    const changeData = percentageChange || { percentage_change: 0, is_increase: true };
    const yourShare = earningsData?.driver_percentage ?? 80;

    const periodTitle =
      selectedPeriod === 'today'
        ? 'Daily Income'
        : selectedPeriod === 'week'
        ? 'Weekly Income'
        : selectedPeriod === 'month'
        ? 'Monthly Income'
        : 'Yearly Income';

    const subText = totalBookings > 0
      ? `${totalBookings} completed · ${formatCurrency(avgEarning)} avg/booking`
      : selectedPeriod === 'today'
      ? 'No earnings yet today'
      : `No earnings for selected ${selectedPeriod}`;

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
            <Text style={styles.splitLabel}>Trips</Text>
            <Text style={styles.splitValue}>{totalBookings}</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Driver Share</Text>
            <Text style={styles.splitValue}>{formatCurrency(totalEarnings)}</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.splitCol}>
            <Text style={styles.splitLabel}>Custom Bookings</Text>
            <Text style={styles.splitValue}>{formatCurrency(earningsData?.custom_booking_earnings || 0)}</Text>
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
        <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
          <Image 
            source={require('../../../assets/TarTrack Logo_sakto.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <View style={styles.loadingTextContainer}>
          <Text style={styles.loadingTextBase}>Fetching your earnings</Text>
          <Animated.Text style={[styles.dot, { opacity: dot1Anim }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: dot2Anim }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: dot3Anim }]}>.</Animated.Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" marginTop="20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>

        {/* FIX: Use the guarded opener so “All” can’t open the calendar */}
        <TouchableOpacity onPress={handleCalendarOpen}>
          {/* <Ionicons name="calendar" size={24} color="#6B2E2B" /> */}
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
      
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onDateSelect={handleDateSelect}
        mode={selectedPeriod === 'today' ? 'day' : selectedPeriod === 'week' ? 'week' : 'month'}
        selectedDate={selectedDate}
        customDateRange={customDateRange}
      />
      
      <YearPicker
        visible={showYearPicker}
        onClose={() => setShowYearPicker(false)}
        onYearSelect={handleDateSelect}
        selectedYear={customDateRange ? new Date(customDateRange.from).getFullYear() : null}
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={() => setShowPayoutHistory(true)}
      >
        <Ionicons name="wallet-outline" size={24} color="#fff" />
      </TouchableOpacity>
      
      <PayoutHistoryModal
        visible={showPayoutHistory}
        onClose={() => setShowPayoutHistory(false)}
        driverId={user?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 230,
    height: 230,
  },
  loadingTextContainer: {
    marginTop: -120,
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16,
    backgroundColor: '#6B2E2B', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', top:20, paddingBottom:20 },
  content: { flex: 1, paddingHorizontal: 16 },

  /* Period selector */
  periodSelectorContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  periodSelector: {
    flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  calendarButton: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  calendarButtonActive: { backgroundColor: '#6B2E2B' },
  calendarControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetButton: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 6 },
  periodButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activePeriodButton: { backgroundColor: '#6B2E2B' },
  periodButtonText: { fontSize: 14, fontWeight: '600', color: '#666' },
  activePeriodButtonText: { color: '#fff' },

  /* Overview (income card) */
  overviewCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F0E7E3',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  incomeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  incomeTitle: { color: '#222', fontWeight: '800', fontSize: 14 },
  rangeText: { color: '#666', fontSize: 12, marginTop: 2 },
  trendChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, gap: 6 },
  trendText: { fontWeight: '800', fontSize: 12 },
  incomeMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  incomeAmount: { fontSize: 28, fontWeight: '900', color: '#222', letterSpacing: 0.2 },
  incomeSub: { color: '#777', marginTop: 2, fontSize: 12 },

  /* Split stats row */
  splitRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, marginTop: 12,
  },
  vDivider: { width: 1, height: 24, backgroundColor: '#EAEAEA' },
  splitCol: { flex: 1, alignItems: 'center' },
  splitLabel: { color: '#777', fontSize: 11, marginBottom: 2 },
  splitValue: { color: '#222', fontSize: 13, fontWeight: '800' },

  /* Earnings list */
  earningsListContainer: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  listTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  earningItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  earningIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  earningDetails: { flex: 1 },
  earningPackage: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  earningDate: { fontSize: 12, color: '#666', marginBottom: 2 },
  earningBookingRef: { fontSize: 11, color: '#999' },
  earningAmounts: { alignItems: 'flex-end' },
  driverEarning: { fontSize: 16, fontWeight: 'bold', color: '#2ecc71', marginBottom: 2 },
  listTotalText: { fontSize: 12, color: '#666' },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 12, marginBottom: 4 },
  emptyStateSubtext: { fontSize: 14, color: '#666', textAlign: 'center' },
  
  /* Floating button */
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B2E2B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

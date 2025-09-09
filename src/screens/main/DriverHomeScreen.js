import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Svg, Rect, Polyline, G, Line, Circle } from 'react-native-svg';
import TARTRACKHeader from '../../components/TARTRACKHeader';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';
import {
  getDriverEarningsStats,
  getEarningsPercentageChange,
  formatCurrency,
  formatPercentage,
} from '../../services/earningsService';
import NotificationService from '../../services/notificationService';
import NotificationManager from '../../components/NotificationManager';

import * as Routes from '../../constants/routes';

const MAROON = '#6B2E2B';
const MAROON_LIGHT = '#F5E9E2';
const TEXT = '#222';
const MUTED = '#777';
const CARD_BG = '#FFFFFF';
const SURFACE = '#F7F7F7';

/* ------------------ fallback notifications ------------------ */
const defaultNotifications = [
  {
    id: 'welcome_1',
    icon: <MaterialCommunityIcons name="calendar-account" size={22} color={MAROON} />,
    message: 'Welcome to Tartanilla Driver!',
    time: 'Now',
  },
  {
    id: 'tip_1',
    icon: <Ionicons name="checkmark-circle" size={22} color={MAROON} />,
    message: 'Complete bookings to start earning',
    time: 'Info',
  },
];

/* ------------------ Mini Activity Chart ------------------ */
function ActivityMiniChart({
  data,
  height = 130,
  barColor = 'rgba(86, 28, 36, 0.14)',
  driverColor = '#6B2E2B',
  orgColor = '#B07C78',
  padding = 12,
}) {
  const [width, setWidth] = React.useState(0);

  const maxTrips = Math.max(...data.map(d => d.trips || 0), 1);
  const maxGross = Math.max(...data.map(d => d.gross || 0), 1);

  const innerW = Math.max(width - padding * 2, 0);
  const innerH = Math.max(height - padding * 2, 0);
  const n = data.length;

  const barGap = 6;
  const barW = n > 0 ? Math.max(innerW / n - barGap, 4) : 0;

  const xFor = (i) => padding + i * (barW + barGap) + barGap / 2;
  const yTrips = (t) => padding + (1 - (t || 0) / maxTrips) * innerH;
  const yGross = (g) => padding + (1 - (g || 0) / maxGross) * innerH;

  // polylines
  const driverPoints = data.map((d, i) => `${xFor(i) + barW / 2},${yGross((d.gross || 0) * 0.8)}`).join(' ');
  const orgPoints = data.map((d, i) => `${xFor(i) + barW / 2},${yGross((d.gross || 0) * 0.2)}`).join(' ');

  // dots
  const driverDots = data.map((d, i) => ({
    cx: xFor(i) + barW / 2,
    cy: yGross((d.gross || 0) * 0.8),
  }));
  const orgDots = data.map((d, i) => ({
    cx: xFor(i) + barW / 2,
    cy: yGross((d.gross || 0) * 0.2),
  }));

  return (
    <View style={{ width: '100%' }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* SVG area with fixed height */}
      <View style={{ width: '100%', height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {/* grid */}
            <G opacity={0.12}>
              <Line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#000" />
              <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#000" />
            </G>

            {/* bars */}
            {data.map((d, i) => {
              const x = xFor(i);
              const y = yTrips(d.trips || 0);
              const h = height - padding - y;
              return (
                <Rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, 2)}
                  rx={6}
                  ry={6}
                  fill={barColor}
                />
              );
            })}

            {/* driver line + dots */}
            <Polyline points={driverPoints} fill="none" stroke={driverColor} strokeWidth={2} />
            {driverDots.map((p, idx) => (
              <Circle key={`dpt-${idx}`} cx={p.cx} cy={p.cy} r={3.5} fill={driverColor} stroke="#fff" strokeWidth={1} />
            ))}

            {/* org line + dots */}
            <Polyline points={orgPoints} fill="none" stroke={orgColor} strokeWidth={2} />
            {orgDots.map((p, idx) => (
              <Circle key={`opt-${idx}`} cx={p.cx} cy={p.cy} r={3.5} fill={orgColor} stroke="#fff" strokeWidth={1} />
            ))}
          </Svg>
        )}
      </View>

      {/* legend BELOW the SVG so it isn’t clipped */}
      <View style={styles.legendRow}>
        <View style={[styles.legendItem, { marginRight: 16 }]}>
          <View style={[styles.legendBox, { backgroundColor: barColor }]} />
          <Text style={styles.legendText}>Trips</Text>
        </View>

        <View style={[styles.legendItem, { marginRight: 16 }]}>
          <View style={[styles.legendLine, { backgroundColor: driverColor }]} />
          <Text style={styles.legendText}>Driver Share</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: orgColor }]} />
          <Text style={styles.legendText}>Org Share</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------ Screen ------------------ */
export default function DriverHomeScreen({ navigation }) {
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const [user, setUser] = useState(null);
  const [earningsData, setEarningsData] = useState(null);
  const [percentageChange, setPercentageChange] = useState(null);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetchUserAndEarnings();

    const initNotifications = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser && (currentUser.role === 'driver' || currentUser.role === 'driver-owner')) {
          try {
            await NotificationService.registerForPushNotifications();
          } catch {
            console.log('[DriverHome] Push notifications not available');
          }
          NotificationService.startPolling(currentUser.id, (newNotifications) => {
            if (newNotifications.length > 0) {
              const latestNotif = newNotifications[0];
              if (latestNotif.type === 'booking') {
                Alert.alert(
                  latestNotif.title,
                  latestNotif.message,
                  [
                    { text: 'View', onPress: () => navigation.navigate('DriverBook') },
                    { text: 'OK' }
                  ]
                );
              }
            }
          });
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initNotifications();
    return () => NotificationService.stopPolling();
  }, []);

  const fetchUserAndEarnings = async () => {
    try {
      setLoading(true);
      let currentUser = await getCurrentUser();
      let userId = null;

      if (currentUser) {
        setUser(currentUser);
        userId = currentUser.id;
      } else {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          setLoading(false);
          return;
        }
        setUser(data.user);
        userId = data.user.id;
      }

      if (userId) {
        await Promise.all([
          fetchEarningsData(userId),
          fetchPercentageChange(userId),
          fetchRecentNotifications(userId),
        ]);
      }
    } catch (error) {
      console.error('Error fetching user and earnings:', error);
      Alert.alert('Error', `Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarningsData = async (driverId) => {
    try {
      const data = await getDriverEarningsStats(driverId, 'month');
      if (data?.success) setEarningsData(data.data);
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setEarningsData({
        total_driver_earnings: 0,
        count: 0,
        earnings_today: 0,
        completed_bookings_today: 0,
        avg_earning_per_booking: 0,
        driver_percentage: 80,
        admin_percentage: 20,
      });
    }
  };

  const fetchPercentageChange = async (driverId) => {
    try {
      const data = await getEarningsPercentageChange(driverId, 'month');
      setPercentageChange(data?.success ? data.data : { percentage_change: 0, is_increase: true });
    } catch {
      setPercentageChange({ percentage_change: 0, is_increase: true });
    }
  };

  const fetchRecentNotifications = async (driverId) => {
    try {
      let { data, error } = await supabase
        .from('bookings')
        .select('id,total_amount,package_name,completed_at,updated_at')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3);

      if (error && /completed_at/.test(error.message || '')) {
        const fb = await supabase
          .from('bookings')
          .select('id,total_amount,package_name,updated_at')
          .eq('driver_id', driverId)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(3);
        data = (fb.data || []).map(b => ({ ...b, completed_at: b.updated_at }));
      }

      if (data && data.length > 0) {
        const earnNotifs = data.map((booking) => {
          const driverEarning = (booking.total_amount || 0) * 0.8;
          return {
            id: `earning_${booking.id}`,
            icon: <MaterialCommunityIcons name="cash" size={22} color="#2ecc71" />,
            message: `+ ${formatCurrency(driverEarning)} from ${booking.package_name || 'tour package'}`,
            time: getTimeAgo(booking.completed_at),
          };
        });
        const summary = {
          id: 'welcome_summary',
          icon: <Ionicons name="checkmark-circle" size={22} color={MAROON} />,
          message: `Completed bookings: ${data.length}`,
          time: 'Summary',
        };
        setNotifications([...earnNotifs, summary]);
      } else {
        setNotifications(defaultNotifications);
      }
    } catch (error) {
      console.error('Error fetching recent notifications:', error);
      setNotifications(defaultNotifications);
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setLastRefresh(new Date());
    await fetchUserAndEarnings();
    setRefreshing(false);
  };

  const navigateToEarningsDetail = () => {
    if (user) {
      navigation.navigate(Routes.DRIVER_EARNINGS);
    } else {
      Alert.alert('Login Required', 'Please log in to view detailed earnings.');
    }
  };

  const totalEarnings = earningsData?.total_driver_earnings || 0;
  const todayEarnings = earningsData?.earnings_today || 0;
  const changeData = percentageChange || { percentage_change: 0, is_increase: true };

  // demo data
  const weeklyDemo = [
    { label: 'Mon', trips: 5,  gross: 500 },
    { label: 'Tue', trips: 8,  gross: 800 },
    { label: 'Wed', trips: 6,  gross: 600 },
    { label: 'Thu', trips: 10, gross: 980 },
    { label: 'Fri', trips: 12, gross: 1100 },
    { label: 'Sat', trips: 15, gross: 1250 },
    { label: 'Sun', trips: 7,  gross: 560 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <NotificationManager navigation={navigation} />
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Earnings Card */}
        <View style={styles.incomeCard}>
          <View style={styles.incomeTopRow}>
            <Text style={styles.incomeTitle}>Monthly Income</Text>
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

          <View style={styles.incomeMainRow}>
            <View style={{ flex: 1 }}>
              {loading ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Text style={styles.incomeAmount}>{formatCurrency(totalEarnings)}</Text>
                  <Text style={styles.incomeSub}>
                    {todayEarnings > 0 ? `Today: ${formatCurrency(todayEarnings)}` : 'No earnings yet today'}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity style={styles.detailBtn} onPress={navigateToEarningsDetail}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {earningsData && (
            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Your share</Text>
                <Text style={styles.splitValue}>{(earningsData.driver_percentage || 80)}%</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Completed</Text>
                <Text style={styles.splitValue}>{earningsData.count || 0}</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Avg / booking</Text>
                <Text style={styles.splitValue}>
                  {formatCurrency(earningsData.avg_earning_per_booking || 0)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Latest Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Latest Activity</Text>
          <Text style={styles.sectionMeta}>Updated {lastRefresh.toLocaleTimeString()}</Text>
        </View>
        <View style={styles.cardList}>
          {notifications.map((notif) => (
            <View key={notif.id} style={styles.listItem}>
              <View style={styles.listIcon}>{notif.icon}</View>
              <Text style={styles.listText} numberOfLines={2}>{notif.message}</Text>
              <Text style={styles.listTime}>{notif.time}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Activity (Chart) */}
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>Weekly Activity</Text>
          <View style={styles.chartBox}>
            <ActivityMiniChart data={weeklyDemo} height={130} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------ styles ------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  incomeCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  incomeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  incomeTitle: { color: TEXT, fontWeight: '800', fontSize: 14 },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trendText: { fontWeight: '800', fontSize: 12 },
  incomeMainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  incomeAmount: { fontSize: 28, fontWeight: '900', color: TEXT, letterSpacing: 0.2 },
  incomeSub: { color: MUTED, marginTop: 2, fontSize: 12 },
  detailBtn: {
    backgroundColor: MAROON,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  vDivider: { width: 1, height: 24, backgroundColor: '#EAEAEA' },
  splitCol: { flex: 1, alignItems: 'center' },
  splitLabel: { color: MUTED, fontSize: 11, marginBottom: 2 },
  splitValue: { color: TEXT, fontSize: 13, fontWeight: '800' },

  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  sectionMeta: { fontSize: 11, color: MUTED },

  cardList: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: MAROON_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  listText: { flex: 1, color: TEXT, fontSize: 13, fontWeight: '600' },
  listTime: { color: MUTED, fontSize: 11, marginLeft: 8 },

  analyticsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  analyticsTitle: { color: TEXT, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  chartBox: {
    width: '100%',
    minHeight: 180,          // a bit more room so legend never overlaps/gets clipped
    backgroundColor: '#ededed',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingBottom: 8,        // breathing room under the SVG
    paddingHorizontal: 10,   // so legend text doesn’t touch edges
  },

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',        // allow wrapping on small screens
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendBox: { width: 12, height: 12, borderRadius: 2, marginRight: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 2, marginRight: 6 },
  legendText: { fontSize: 12, color: '#555', fontWeight: '600' },
});

//DRIVER HOME SCREEN

// screens/DriverHomeScreen.js
import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';

import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';
import {
  getDriverEarningsStats,
  getEarningsPercentageChange,
  getPendingPayoutAmount,
  formatCurrency,
  formatPercentage,
} from '../../services/Earnings/EarningsService';
import { getCarriagesByDriver } from '../../services/api';
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

/* ------------------ helpers ------------------ */
const formatClockTime = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
};

/* ------------------ Mini Activity Chart ------------------ */
import { Svg, Rect, Polyline, G, Line, Circle } from 'react-native-svg';
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

  const driverPoints = data.map((d, i) => `${xFor(i) + barW / 2},${yGross((d.gross || 0) * 0.8)}`).join(' ');
  const orgPoints = data.map((d, i) => `${xFor(i) + barW / 2},${yGross((d.gross || 0) * 0.2)}`).join(' ');

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
      <View style={{ width: '100%', height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <G opacity={0.12}>
              <Line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#000" />
              <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#000" />
            </G>

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

            <Polyline points={driverPoints} fill="none" stroke={driverColor} strokeWidth={2} />
            {driverDots.map((p, idx) => (
              <Circle key={`dpt-${idx}`} cx={p.cx} cy={p.cy} r={3.5} fill={driverColor} stroke="#fff" strokeWidth={1} />
            ))}

            <Polyline points={orgPoints} fill="none" stroke={orgColor} strokeWidth={2} />
            {orgDots.map((p, idx) => (
              <Circle key={`opt-${idx}`} cx={p.cx} cy={p.cy} r={3.5} fill={orgColor} stroke="#fff" strokeWidth={1} />
            ))}
          </Svg>
        )}
      </View>

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

/* ------------------ Modern Location Card ------------------ */
function LocationCard({ locationStatus }) {
  const { isTracking, lastUpdateTime, error } = locationStatus || {};
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTracking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isTracking, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const pillStyle =
    error
      ? { bg: '#FDECEC', fg: '#B91C1C', icon: 'warning' }
      : isTracking
      ? { bg: '#EAF7EE', fg: '#2E7D32', icon: 'radio' }
      : { bg: '#EFEFEF', fg: '#4B5563', icon: 'radio-button-off' };

  const timeText = error
    ? 'Location error'
    : isTracking
    ? `Last update ${formatClockTime(lastUpdateTime)}`
    : 'Tracking is off';

  return (
    <View style={styles.locCard}>
      {/* decorative blobs */}
      <View style={styles.locBlobOne} />
      <View style={styles.locBlobTwo} />

      <View style={styles.locHeaderRow}>
        <View style={styles.locIconWrap}>
          {isTracking && <Animated.View style={[styles.locPulse, { transform: [{ scale }], opacity }]} />}
          <View style={styles.locIconCircle}>
            <Ionicons name="location" size={16} color={MAROON} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.locTitle}>Live Location</Text>
          <Text style={styles.locSubtitle}>{timeText}</Text>
        </View>

        <View style={[styles.locPill, { backgroundColor: pillStyle.bg }]}>
          <Ionicons
            name={pillStyle.icon}
            size={12}
            color={pillStyle.fg}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.locPillText, { color: pillStyle.fg }]}>
            {error ? 'Error' : isTracking ? 'On' : 'Off'}
          </Text>
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
  const [pendingPayoutAmount, setPendingPayoutAmount] = useState(0); // admin pending
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [customTourEarnings, setCustomTourEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState({ isTracking: false, lastUpdateTime: null, error: null });

  useEffect(() => {
    fetchUserAndEarnings();

    const init = async () => {
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
          
          // Start location tracking + realtime updates
          try {
            const LocationService = (await import('../../services/locationService')).default;
            await LocationService.startTracking(currentUser.id);
            setLocationStatus({ isTracking: true, lastUpdateTime: new Date(), error: null });

            // Prefer a native subscription if your service exposes one
            let unsubscribe = null;
            if (typeof LocationService.onUpdate === 'function') {
              unsubscribe = LocationService.onUpdate((payload) => {
                const ts = payload?.timestamp ? new Date(payload.timestamp) : new Date();
                setLocationStatus(prev => ({ ...prev, isTracking: true, lastUpdateTime: ts, error: null }));
              });
            }

            // Fallback: heartbeat to keep "Last update" fresh if no subscription
            let heartbeat = null;
            if (!unsubscribe) {
              heartbeat = setInterval(() => {
                setLocationStatus(prev => prev.isTracking ? { ...prev, lastUpdateTime: new Date() } : prev);
              }, 5000);
            }

            return () => {
              if (unsubscribe) unsubscribe();
              if (heartbeat) clearInterval(heartbeat);
            };
          } catch (error) {
            console.error('Failed to start location tracking:', error);
            setLocationStatus({ isTracking: false, lastUpdateTime: null, error: error.message });
          }
        }
      } catch (error) {
        console.error('Init error:', error);
      }
    };

    const cleanupPromise = init();

    return () => {
      NotificationService.stopPolling();
      try {
        import('../../services/locationService').then(({ default: LocationService }) => {
          LocationService.stopTracking();
        });
      } catch (error) {
        console.error('Failed to stop location tracking:', error);
      }
      Promise.resolve(cleanupPromise).then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
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
          fetchPending(userId),
          fetchPendingAssignments(userId),
          fetchCustomTourEarnings(userId),
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
      console.log('MoM Growth Data:', data?.data);
      setPercentageChange(data?.success ? data.data : { percentage_change: 0, is_increase: true });
    } catch {
      setPercentageChange({ percentage_change: 0, is_increase: true });
    }
  };

  const fetchPending = async (driverId) => {
    try {
      const res = await getPendingPayoutAmount(driverId);
      setPendingPayoutAmount(res?.data?.amount || 0);
    } catch {
      setPendingPayoutAmount(0);
    }
  };

  const fetchPendingAssignments = async (driverId) => {
    try {
      const response = await getCarriagesByDriver(driverId);
      if (response.success) {
        const pending = response.data.filter(c => c.status === 'waiting_driver_acceptance');
        setPendingAssignments(pending.length);
      }
    } catch {
      setPendingAssignments(0);
    }
  };

  const fetchCustomTourEarnings = async (driverId) => {
    try {
      // Custom tours are typically stored in a separate table or marked with a specific type
      const { data, error } = await supabase
        .from('bookings')
        .select('total_amount')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .eq('booking_type', 'custom') // Assuming custom tours have this field
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
      
      if (!error && data) {
        const total = data.reduce((sum, booking) => sum + (booking.total_amount || 0), 0);
        setCustomTourEarnings(total);
      }
    } catch (error) {
      console.error('Error fetching custom tour earnings:', error);
      setCustomTourEarnings(0);
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

      {/* Modern Location Card (time updates on each location ping) */}
      <LocationCard locationStatus={locationStatus} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Earnings Card with moved background design */}
        <View style={styles.incomeCard}>
          <View style={styles.incomeBgOne} />
          <View style={styles.incomeBgTwo} />

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
                <Text style={styles.splitLabel}>Trips</Text>
                <Text style={styles.splitValue}>{earningsData.count || 0}</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Driver Share</Text>
                <Text style={styles.splitValue}>{formatCurrency(earningsData.total_driver_earnings || 0)}</Text>
              </View>
              <View style={styles.vDivider} />
              <View style={styles.splitCol}>
                <Text style={styles.splitLabel}>Custom Bookings</Text>
                <Text style={styles.splitValue}>{formatCurrency(customTourEarnings || earningsData?.custom_booking_earnings || 0)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Pending Assignments */}
        {pendingAssignments > 0 && (
          <TouchableOpacity 
            style={styles.pendingCard}
            onPress={() => navigation.navigate('DriverCarriageAssignments')}
          >
            <View style={styles.pendingHeader}>
              <View style={styles.pendingIcon}>
                <MaterialCommunityIcons name="progress-clock" size={24} color={MAROON} />
              </View>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingTitle}>Pending Assignments</Text>
                <Text style={styles.pendingSubtitle}>
                  {pendingAssignments} carriage{pendingAssignments > 1 ? 's' : ''} waiting for your response
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MAROON} />
            </View>
          </TouchableOpacity>
        )}

        {/* To be Paid (old design, white bg), with admin processed under the pill */}
        <View style={styles.toBePaidCard}>
          <View style={styles.toBePaidRow}>
            <Text style={styles.toBePaidLabel}>Pending Payout</Text>

            <Text style={styles.toBePaidAmount}>{formatCurrency(pendingPayoutAmount)}</Text>

            <View style={styles.toBePaidRight}>
              <View
                style={[
                  styles.statusPill,
                  pendingPayoutAmount > 0 ? styles.pillPending : styles.pillPaid
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    pendingPayoutAmount > 0 ? styles.pending : styles.paid
                  ]}
                >
                  {pendingPayoutAmount > 0 ? 'Pending' : '—'}
                </Text>
              </View>

              <View style={styles.adminRow}>
                <Ionicons name="shield-checkmark-outline" size={12} color={MUTED} />
                <Text style={styles.adminText}>Admin processed</Text>
              </View>
            </View>
          </View>
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

        {/* Financial Analytics - Real-time Business Intelligence */}
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>How You're Doing</Text>
          
          {/* Profit Margin Analysis */}
          <View style={styles.analyticsSection}>
            <Text style={styles.analyticsSectionTitle}>How Much You Keep</Text>
            <View style={styles.marginContainer}>
              <View style={styles.marginRow}>
                <Text style={styles.marginLabel}>Tour Package Trips</Text>
                <View style={styles.marginBar}>
                  <View style={[styles.marginFill, { width: `${(() => {
                    const totalTrips = earningsData?.count || 0;
                    const customTrips = customTourEarnings > 0 ? Math.ceil(customTourEarnings / (earningsData?.avg_earning_per_booking || 1)) : 0;
                    const packageTrips = totalTrips - customTrips;
                    return totalTrips > 0 ? Math.round((packageTrips / totalTrips) * 100) : 0;
                  })()}%` }]} />
                  <Text style={styles.marginText}>{(() => {
                    const totalTrips = earningsData?.count || 0;
                    const customTrips = customTourEarnings > 0 ? Math.ceil(customTourEarnings / (earningsData?.avg_earning_per_booking || 1)) : 0;
                    const packageTrips = totalTrips - customTrips;
                    return totalTrips > 0 ? Math.round((packageTrips / totalTrips) * 100) : 0;
                  })()}%</Text>
                </View>
              </View>
              <View style={styles.marginRow}>
                <Text style={styles.marginLabel}>Your Own Tours</Text>
                <View style={styles.marginBar}>
                  <View style={[styles.marginFillCustom, { width: customTourEarnings > 0 ? '100%' : '0%' }]} />
                  <Text style={styles.marginText}>{customTourEarnings > 0 ? '100%' : '0%'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Key Financial Ratios */}
          <View style={styles.analyticsSection}>
            <Text style={styles.analyticsSectionTitle}>Your Numbers</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{formatCurrency(earningsData?.avg_earning_per_booking || 0).replace('₱', '')}</Text>
                <Text style={styles.metricLabel}>Per Trip</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{Math.round((totalEarnings / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() / 8) || 0)}</Text>
                <Text style={styles.metricLabel}>Per Hour</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{((earningsData?.count || 0) / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()).toFixed(1)}</Text>
                <Text style={styles.metricLabel}>Trips Daily</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: changeData.is_increase ? '#2E7D32' : '#C62828' }]}>
                  {(changeData.percentage_change || 0).toFixed(1)}%
                </Text>
                <Text style={styles.metricLabel}>This Month</Text>
              </View>
            </View>
          </View>

          {/* Earnings Health Score */}
          <View style={styles.analyticsSection}>
            <Text style={styles.analyticsSectionTitle}>Earnings Score</Text>
            <View style={styles.efficiencyContainer}>
              <View style={styles.efficiencyCircle}>
                <Text style={styles.efficiencyScore}>
                  {(() => {
                    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                    const tripsPerDay = (earningsData?.count || 0) / daysInMonth;
                    const monthlyEarnings = totalEarnings;
                    const isGrowing = changeData.is_increase;
                    const hasCustomTours = customTourEarnings > 0;
                    
                    let score = 0;
                    
                    // How active are you? (0-30 points)
                    if (tripsPerDay >= 3) score += 30;
                    else if (tripsPerDay >= 2) score += 20;
                    else if (tripsPerDay >= 1) score += 10;
                    
                    // How much do you earn? (0-40 points)
                    if (monthlyEarnings >= 30000) score += 40;
                    else if (monthlyEarnings >= 20000) score += 30;
                    else if (monthlyEarnings >= 10000) score += 20;
                    else if (monthlyEarnings >= 5000) score += 10;
                    
                    // Are you growing? (0-20 points)
                    if (isGrowing && changeData.percentage_change >= 10) score += 20;
                    else if (isGrowing && changeData.percentage_change >= 5) score += 15;
                    else if (isGrowing) score += 10;
                    
                    // Do you have different income sources? (0-10 points)
                    if (hasCustomTours) score += 10;
                    
                    return Math.min(100, score).toString();
                  })()
                }
                </Text>
                <Text style={styles.efficiencyLabel}>Score</Text>
              </View>
              <View style={styles.efficiencyDetails}>
                <Text style={styles.efficiencyText}>Shows how well you earn money. Based on: Daily trips, Monthly income, Growth, Own tours</Text>
                <Text style={styles.efficiencyTip}>
                  {(() => {
                    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                    const score = Math.min(100, 
                      ((earningsData?.count || 0) / daysInMonth >= 3 ? 30 : (earningsData?.count || 0) / daysInMonth >= 2 ? 20 : (earningsData?.count || 0) / daysInMonth >= 1 ? 10 : 0) +
                      (totalEarnings >= 30000 ? 40 : totalEarnings >= 20000 ? 30 : totalEarnings >= 10000 ? 20 : totalEarnings >= 5000 ? 10 : 0) +
                      (changeData.is_increase ? (changeData.percentage_change >= 10 ? 20 : changeData.percentage_change >= 5 ? 15 : 10) : 0) +
                      (customTourEarnings > 0 ? 10 : 0)
                    );
                    
                    if (score >= 80) return '🎉 Excellent! You have great earnings. Keep it up!';
                    if (score >= 60) return '💼 Your earnings are fine. Keep accepting bookings.';
                    if (score >= 40) return '🚗 Take more tours and bookings to earn more.';
                    return '💪 Take more tours and bookings to increase earnings and score.';
                  })()
                }
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------ styles ------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  /* --- Location Card (no actions) --- */
  locCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFF9F7',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0E7E3',
    overflow: 'hidden',

    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  locBlobOne: {
    position: 'absolute',
    right: -22,
    top: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(107,46,43,0.06)',
  },
  locBlobTwo: {
    position: 'absolute',
    left: -30,
    bottom: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(107,46,43,0.04)',
  },
  locHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  locIconWrap: { width: 42, height: 42, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  locPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MAROON,
  },
  locIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ECD9D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  locSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#00000010',
  },
  locPillText: { fontSize: 12, fontWeight: '800' },

  /* --- Earnings Card (with payout-style background design) --- */
  incomeCard: {
    backgroundColor: '#FFF7F8', // tinted background moved here
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: '#F0E7E3',
    overflow: 'hidden',
  },
  incomeBgOne: {
    position: 'absolute',
    right: -18,
    top: -22,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(107,46,43,0.05)',
  },
  incomeBgTwo: {
    position: 'absolute',
    left: -28,
    bottom: -28,
    width: 95,
    height: 95,
    borderRadius: 48,
    backgroundColor: 'rgba(107,46,43,0.035)',
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

  /* Pending Assignments */
  pendingCard: {
    backgroundColor: MAROON_LIGHT,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: MAROON,
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center' },
  pendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MAROON_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pendingInfo: { flex: 1 },
  pendingTitle: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 2 },
  pendingSubtitle: { fontSize: 13, color: MUTED },

  /* --- To be Paid (old design, white bg) --- */
  toBePaidCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  toBePaidRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  rowDivider: { height: 1, backgroundColor: '#EAEAEA', marginHorizontal: 14 },
  toBePaidLabel: { flex: 1, color: TEXT, fontWeight: '700', fontSize: 13 },
  toBePaidAmount: { color: TEXT, fontWeight: '800', marginRight: 24, fontSize: 15 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusText: { fontWeight: '800', fontSize: 12 },
  pillPaid: { backgroundColor: '#E8F5E9', borderColor: '#E8F5E9' },
  pillPending: { backgroundColor: '#E5E5E5', borderColor:'#E5E5E5' },
  paid: { color: '#2E7D32' },
  pending: { color: MAROON },
  toBePaidRight: { alignItems: 'flex-end' },
  adminRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  adminText: { marginLeft: 5, fontSize: 10, color: MUTED },

  /* Section + lists */
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  section:{fontSize: 14, fontWeight: '800', color: TEXT, marginLeft: 18, marginTop:10},
  sectionTitle: { fontSize: 14, fontWeight: '800', color: TEXT},
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
  analyticsTitle: { color: TEXT, fontSize: 14, fontWeight: '800', marginBottom: 16 },
  
  analyticsSection: { marginBottom: 16 },
  analyticsSectionTitle: { fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8 },
  
  /* Profit Margin */
  marginContainer: {
    gap: 8,
  },
  marginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marginLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT,
    width: 80,
  },
  marginBar: {
    flex: 1,
    height: 20,
    backgroundColor: SURFACE,
    borderRadius: 10,
    position: 'relative',
    justifyContent: 'center',
  },
  marginFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    backgroundColor: MAROON,
    borderRadius: 10,
  },
  marginFillCustom: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 10,
  },
  marginText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    zIndex: 1,
  },
  
  /* Metrics Grid */
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
  },
  metricLabel: {
    fontSize: 10,
    color: MUTED,
    marginTop: 2,
  },
  
  /* Efficiency Score */
  efficiencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  efficiencyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: MAROON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  efficiencyScore: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  efficiencyLabel: {
    fontSize: 8,
    color: '#fff',
    marginTop: -2,
  },
  efficiencyDetails: {
    flex: 1,
  },
  efficiencyText: {
    fontSize: 11,
    color: MUTED,
    lineHeight: 16,
  },
  efficiencyTip: {
    fontSize: 11,
    color: TEXT,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 16,
  },
  
  /* Chart Legend */
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 12,
    height: 8,
    borderRadius: 2,
    marginRight: 6,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: MUTED,
    fontWeight: '600',
  },
});

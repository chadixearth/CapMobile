import React, { useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { getDriverEarningsStats, getEarningsPercentageChange, formatCurrency, formatPercentage } from '../../services/earningsService';
import * as Routes from '../../constants/routes';

// Default fallback notifications
const defaultNotifications = [
  {
    id: 'welcome_1',
    icon: <MaterialCommunityIcons name="calendar-account" size={24} color="#6B2E2B" />,
    message: 'Welcome to Tartanilla Driver!',
    time: 'Now',
  },
  {
    id: 'tip_1',
    icon: <Ionicons name="checkmark-circle" size={24} color="#6B2E2B" />,
    message: 'Complete bookings to start earning',
    time: 'Info',
  },
];

export default function DriverHomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [earningsData, setEarningsData] = useState(null);
  const [percentageChange, setPercentageChange] = useState(null);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetchUserAndEarnings();
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
      if (data?.success) {
        setEarningsData(data.data);
      } else if (data?.error) {
        console.error('Failed to fetch earnings data:', data.error);
      }
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
      if (data?.success) {
        setPercentageChange(data.data);
      } else {
        setPercentageChange({ percentage_change: 0, is_increase: true });
      }
    } catch (error) {
      console.error('Error fetching percentage change:', error);
      setPercentageChange({ percentage_change: 0, is_increase: true });
    }
  };

  const fetchRecentNotifications = async (driverId) => {
    try {
      // Primary attempt: use completed_at if the column exists
      let query = supabase
        .from('bookings')
        .select('id,total_amount,package_name,completed_at,updated_at')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3);

      let { data, error } = await query;

      // Fallback if schema doesn't have completed_at (PGRST204)
      if (error && /completed_at/.test(error.message || '')) {
        const fallback = await supabase
          .from('bookings')
          .select('id,total_amount,package_name,updated_at')
          .eq('driver_id', driverId)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(3);
        error = fallback.error;
        data = (fallback.data || []).map((b) => ({ ...b, completed_at: b.updated_at }));
      }

      if (!error && data && data.length > 0) {
        const earningsNotifications = data.map((booking) => {
          const driverEarning = (booking.total_amount || 0) * 0.8; // 80% to driver
          const timeAgo = getTimeAgo(booking.completed_at);
          return {
            id: `earning_${booking.id}`,
            icon: <MaterialCommunityIcons name="cash" size={24} color="#2ecc71" />,
            message: `+ You've earned ${formatCurrency(driverEarning)} from ${booking.package_name || 'tour package'}`,
            time: timeAgo,
          };
        });

        const welcomeNotification = {
          id: 'welcome_summary',
          icon: <Ionicons name="checkmark-circle" size={24} color="#6B2E2B" />,
          message: `Total completed bookings: ${data.length}`,
          time: 'Summary',
        };

        setNotifications([...earningsNotifications, welcomeNotification]);
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

  const renderIncomeCard = () => {
    const totalEarnings = earningsData?.total_driver_earnings || 0;
    const changeData = percentageChange || { percentage_change: 0, is_increase: true };
    const todayEarnings = earningsData?.earnings_today || 0;

    return (
      <View style={styles.incomeCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={styles.incomeLabel}>Monthly Income</Text>
          <View style={styles.incomeStat}>
            <Ionicons
              name={changeData.is_increase ? 'trending-up-outline' : 'trending-down-outline'}
              size={14}
              color={changeData.is_increase ? '#2ecc71' : '#e74c3c'}
            />
            <Text style={[styles.incomeStatText, { color: changeData.is_increase ? '#2ecc71' : '#e74c3c' }]}>
              {changeData.is_increase ? '+' : '-'}{formatPercentage(changeData.percentage_change)}
            </Text>
          </View>
          <Text style={styles.incomeHigher}>{changeData.is_increase ? 'Higher' : 'Lower'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.incomeAmount}>{formatCurrency(totalEarnings)}</Text>
            {todayEarnings > 0 && <Text style={styles.todayEarnings}>Today: {formatCurrency(todayEarnings)}</Text>}
          </View>
          <TouchableOpacity style={styles.incomeArrow} onPress={navigateToEarningsDetail}>
            <Ionicons name="arrow-forward-circle" size={28} color="#bbb" />
          </TouchableOpacity>
        </View>

        {earningsData && (
          <View style={styles.earningsInfo}>
            <Text style={styles.earningsInfoText}>
              You earn {earningsData.driver_percentage || 80}% from each completed booking
            </Text>
            <Text style={styles.earningsInfoSubtext}>
              {earningsData.count || 0} completed bookings • Avg: {formatCurrency(earningsData.avg_earning_per_booking || 0)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>TARTRACK</Text>
          {user && (
            <Text style={styles.welcomeText}>
              Welcome, {user.name || user.user_metadata?.name || user.email || 'Driver'}!
            </Text>
          )}
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notification')}>
            <Ionicons name="notifications-outline" size={22} color="#222" style={styles.icon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Chat')}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#222" style={styles.icon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (user ? navigation.navigate('Profile') : Alert.alert('Login Required', 'Please log in to access profile.'))}
          >
            <Ionicons name="person-circle-outline" size={26} color="#222" style={styles.icon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Income Card */}
      {loading ? (
        <View style={[styles.incomeCard, styles.loadingCard]}>
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      ) : (
        renderIncomeCard()
      )}

      {/* Latest Notifications */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Latest Activity</Text>
        <Text style={styles.lastRefreshText}>Updated: {lastRefresh.toLocaleTimeString()}</Text>
      </View>
      {notifications.map((notif) => (
        <View key={notif.id} style={styles.notifCard}>
          <View style={styles.notifIcon}>{notif.icon}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifMsg}>{notif.message}</Text>
          </View>
          <Text style={styles.notifTime}>{notif.time}</Text>
        </View>
      ))}

      {/* Data Analytics */}
      <Text style={styles.sectionTitle}>Data Analytics</Text>
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsLabel}>Activity</Text>
        <View style={styles.barChartPlaceholder}>
          <Image
            source={{ uri: 'https://dummyimage.com/300x80/ededed/aaa&text=Bar+Chart' }}
            style={{ width: '100%', height: 80, borderRadius: 8 }}
          />
        </View>
        <Text style={styles.analyticsMonth}>Month</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 8,
  },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#7B3F00', letterSpacing: 1 },
  welcomeText: { fontSize: 12, color: '#666', marginTop: 2 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginLeft: 16 },

  incomeCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  incomeLabel: { fontWeight: 'bold', color: '#2ecc71', marginRight: 8 },
  incomeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eafaf1',
    borderRadius: 8,
    paddingHorizontal: 6,
    marginRight: 8,
    marginLeft: 2,
  },
  incomeStatText: { color: '#2ecc71', fontSize: 12, fontWeight: 'bold', marginLeft: 2 },
  incomeHigher: { fontSize: 12, color: '#666', fontWeight: '500' },
  incomeAmount: { fontSize: 28, fontWeight: 'bold', color: '#222' },
  todayEarnings: { fontSize: 14, color: '#2ecc71', fontWeight: '500', marginTop: 2 },
  incomeArrow: { marginLeft: 8 },
  earningsInfo: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  earningsInfoText: { fontSize: 12, color: '#666', fontWeight: '500' },
  earningsInfoSubtext: { fontSize: 11, color: '#999', marginTop: 2 },
  loadingCard: { justifyContent: 'center', alignItems: 'center', height: 120 },
  loadingText: { color: '#666', fontSize: 16 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  lastRefreshText: { fontSize: 10, color: '#999' },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  notifIcon: { marginRight: 12 },
  notifMsg: { color: '#222', fontSize: 14, fontWeight: '500' },
  notifTime: { color: '#aaa', fontSize: 12, marginLeft: 8 },

  analyticsCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  analyticsLabel: { fontWeight: 'bold', color: '#222', marginBottom: 8, alignSelf: 'flex-start' },
  barChartPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#ededed',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  analyticsMonth: { color: '#888', fontSize: 12, alignSelf: 'flex-end', marginTop: 2 },
});

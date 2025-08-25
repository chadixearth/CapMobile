import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl, 
  Alert,
  Dimensions 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { 
  getDriverEarningsStats, 
  getEarningsPercentageChange, 
  formatCurrency, 
  formatPercentage,
  getDriverEarnings 
} from '../../services/earningsService';

const { width } = Dimensions.get('window');

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
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
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
          fetchPercentageChange(userId)
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
      const data = await getEarningsPercentageChange(driverId, selectedPeriod === 'week' ? 'week' : 'month');
      if (data.success) {
        setPercentageChange(data.data);
      }
    } catch (error) {
      console.error('Error fetching percentage change:', error);
    }
  };

  const getDateFilters = (period) => {
    const now = new Date();
    const filters = {};
    
    switch (period) {
      case 'today':
        const today = now.toISOString().split('T')[0];
        filters.date_from = today;
        filters.date_to = today;
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filters.date_from = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filters.date_from = monthAgo.toISOString().split('T')[0];
        break;
      // 'all' means no date filter
    }
    
    return filters;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndEarnings();
    setRefreshing(false);
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {['today', 'week', 'month', 'all'].map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.activePeriodButton
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text style={[
            styles.periodButtonText,
            selectedPeriod === period && styles.activePeriodButtonText
          ]}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEarningsOverview = () => {
    const totalEarnings = earningsData?.total_driver_earnings || 0;
    const changeData = percentageChange || { percentage_change: 0, is_increase: true };
    const totalBookings = earningsData?.count || 0;
    const avgEarning = earningsData?.avg_earning_per_booking || 0;
    
    return (
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>
            {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Earnings
          </Text>
          <View style={styles.changeIndicator}>
            <Ionicons 
              name={changeData.is_increase ? "trending-up" : "trending-down"} 
              size={16} 
              color={changeData.is_increase ? "#2ecc71" : "#e74c3c"} 
            />
            <Text style={[
              styles.changeText,
              { color: changeData.is_increase ? "#2ecc71" : "#e74c3c" }
            ]}>
              {changeData.is_increase ? '+' : '-'}{formatPercentage(changeData.percentage_change)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.totalAmount}>{formatCurrency(totalEarnings)}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalBookings}</Text>
            <Text style={styles.statLabel}>Completed Bookings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrency(avgEarning)}</Text>
            <Text style={styles.statLabel}>Avg per Booking</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{earningsData?.driver_percentage || 80}%</Text>
            <Text style={styles.statLabel}>Your Share</Text>
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
                  minute: '2-digit'
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
              <Text style={styles.totalAmount}>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
    paddingTop: 44,
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2ecc71',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  earningsListContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  totalAmount: {
    fontSize: 12,
    color: '#666',
  },
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
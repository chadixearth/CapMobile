import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { checkExistingReviews } from '../../services/reviews';
import { getAnonymousReviewSetting } from '../../services/userSettings';
import { apiBaseUrl } from '../../services/networkConfig';
import { getAccessToken } from '../../services/authService';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function BookingHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Animation refs for loading
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  const categories = [
    { id: 'all', label: 'All', icon: 'list' },
    { id: 'tour', label: 'Tour Package', icon: 'map' },
    { id: 'custom', label: 'Custom', icon: 'settings' },
    { id: 'special', label: 'Special Event', icon: 'star' }
  ];

  const categorizeBooking = (booking) => {
    const packageName = booking.package_data?.package_name?.toLowerCase() || '';
    const bookingType = booking.booking_type?.toLowerCase() || '';
    
    if (packageName.includes('custom') || bookingType.includes('custom')) {
      return 'custom';
    }
    if (packageName.includes('special') || packageName.includes('event') || bookingType.includes('special')) {
      return 'special';
    }
    return 'tour';
  };

  const filteredBookings = selectedCategory === 'all' 
    ? bookings 
    : bookings.filter(b => categorizeBooking(b) === selectedCategory);

  const fetchBookings = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch user's bookings from API
      const response = await fetch(`${apiBaseUrl()}/tour-booking/`, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const userBookings = (data.data || data).filter(
          booking => booking.customer_id === user?.id
        );
        setBookings(userBookings);
        
        // Check review status for completed bookings
        const completedBookings = userBookings.filter(b => b.status === 'completed');
        const reviewStatusMap = {};
        
        for (const booking of completedBookings) {
          try {
            const result = await checkExistingReviews({
              booking_id: booking.id,
              reviewer_id: user?.id
            });
            
            if (result.success) {
              reviewStatusMap[booking.id] = result.data;
            }
          } catch (error) {
            console.error('Error checking review status:', error);
          }
        }
        
        setReviewStatus(reviewStatusMap);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  // Animation effect for loading
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
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      const dot1Animation = createDotAnimation(dot1Anim, 0);
      const dot2Animation = createDotAnimation(dot2Anim, 200);
      const dot3Animation = createDotAnimation(dot3Anim, 400);
      
      pulse.start();
      dot1Animation.start();
      dot2Animation.start();
      dot3Animation.start();
      
      return () => {
        pulse.stop();
        dot1Animation.stop();
        dot2Animation.stop();
        dot3Animation.stop();
      };
    }
  }, [loading, pulseAnim, dot1Anim, dot2Anim, dot3Anim]);

  const onRefresh = () => {
    fetchBookings(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#2E7D32';
      case 'confirmed': return '#1976D2';
      case 'pending': return '#F57C00';
      case 'cancelled': return '#D32F2F';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'confirmed': return 'time';
      case 'pending': return 'hourglass';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'tour': return '#FF9800';
      case 'custom': return '#9C27B0';
      case 'special': return '#E91E63';
      default: return MAROON;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'tour': return 'map';
      case 'custom': return 'settings';
      case 'special': return 'star';
      default: return 'list';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'tour': return 'Tour';
      case 'custom': return 'Custom';
      case 'special': return 'Special';
      default: return 'General';
    }
  };

  const handleReviewPress = async (booking) => {
    try {
      // Get user's anonymous preference
      const anonymousSetting = await getAnonymousReviewSetting();
      const isAnonymous = anonymousSetting.success ? anonymousSetting.data.isAnonymous : false;

      // Show anonymous review prompt
      Alert.alert(
        'Leave a Review',
        `Would you like to remain anonymous in your review?\n\nCurrent setting: ${isAnonymous ? 'Anonymous' : 'Show my name'}`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Change Setting',
            onPress: () => navigation.navigate('AccountDetails')
          },
          {
            text: 'Continue',
            onPress: () => {
              navigation.navigate('ReviewSubmission', {
                booking: booking,
                package: booking.package_data,
                driver: booking.driver_data,
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error handling review press:', error);
      navigation.navigate('ReviewSubmission', {
        booking: booking,
        package: booking.package_data,
        driver: booking.driver_data,
      });
    }
  };

  const renderBooking = (booking) => {
    const status = reviewStatus[booking.id];
    const hasPackageReview = status?.hasPackageReview || false;
    const hasDriverReview = status?.hasDriverReview || false;
    const canReview = booking.status === 'completed' && (!hasPackageReview || !hasDriverReview);

    return (
      <View key={booking.id} style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.bookingTitle} numberOfLines={2}>
                {booking.package_data?.package_name || 'Tour Package'}
              </Text>
              <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(categorizeBooking(booking)) + '20' }]}>
                <Ionicons 
                  name={getCategoryIcon(categorizeBooking(booking))} 
                  size={12} 
                  color={getCategoryColor(categorizeBooking(booking))} 
                />
                <Text style={[styles.categoryTagText, { color: getCategoryColor(categorizeBooking(booking)) }]}>
                  {getCategoryLabel(categorizeBooking(booking))}
                </Text>
              </View>
            </View>
            <Text style={styles.bookingDate}>
              {new Date(booking.created_at).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
            <Ionicons 
              name={getStatusIcon(booking.status)} 
              size={14} 
              color={getStatusColor(booking.status)} 
            />
            <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Text>
          </View>
        </View>

        {booking.package_data && (
          <View style={styles.packageInfo}>
            <Text style={styles.packageDetail}>
              Duration: {booking.package_data.duration_hours || 'N/A'} hours
            </Text>
            <Text style={styles.packageDetail}>
              Price: ₱{booking.package_data.price || 'N/A'}
            </Text>
          </View>
        )}

        {booking.driver_data && (
          <View style={styles.driverInfo}>
            <Ionicons name="person" size={16} color={MAROON} />
            <Text style={styles.driverName}>
              Driver: {booking.driver_data.name || 'Assigned Driver'}
            </Text>
          </View>
        )}

        {/* Review Section for Completed Bookings */}
        {booking.status === 'completed' && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.reviewHeaderText}>Reviews</Text>
            </View>
            
            <View style={styles.reviewStatus}>
              <View style={styles.reviewItem}>
                <Ionicons 
                  name={hasPackageReview ? "checkmark-circle" : "ellipse-outline"} 
                  size={14} 
                  color={hasPackageReview ? "#2E7D32" : "#999"} 
                />
                <Text style={[styles.reviewItemText, hasPackageReview && styles.reviewItemCompleted]}>
                  Package Review
                </Text>
              </View>
              
              <View style={styles.reviewItem}>
                <Ionicons 
                  name={hasDriverReview ? "checkmark-circle" : "ellipse-outline"} 
                  size={14} 
                  color={hasDriverReview ? "#2E7D32" : "#999"} 
                />
                <Text style={[styles.reviewItemText, hasDriverReview && styles.reviewItemCompleted]}>
                  Driver Review
                </Text>
              </View>
            </View>

            {canReview && (
              <TouchableOpacity
                style={styles.reviewButton}
                onPress={() => handleReviewPress(booking)}
                activeOpacity={0.8}
              >
                <Ionicons name="star-outline" size={16} color="#fff" />
                <Text style={styles.reviewButtonText}>
                  {!hasPackageReview && !hasDriverReview ? 'Leave Review' : 'Complete Review'}
                </Text>
              </TouchableOpacity>
            )}

            {hasPackageReview && hasDriverReview && (
              <View style={styles.reviewCompleted}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                <Text style={styles.reviewCompletedText}>Reviews completed</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {categories.map((category) => {
            const categoryCount = category.id === 'all' 
              ? bookings.length 
              : bookings.filter(b => categorizeBooking(b) === category.id).length;
            
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryBtn,
                  selectedCategory === category.id && styles.categoryBtnActive
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Ionicons 
                  name={category.icon} 
                  size={16} 
                  color={selectedCategory === category.id ? '#fff' : MAROON} 
                />
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive
                ]}>
                  {category.label}
                </Text>
                {categoryCount > 0 && (
                  <View style={[
                    styles.categoryBadge,
                    selectedCategory === category.id && styles.categoryBadgeActive
                  ]}>
                    <Text style={[
                      styles.categoryBadgeText,
                      selectedCategory === category.id && styles.categoryBadgeTextActive
                    ]}>
                      {categoryCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
              <Image 
                source={require('../../../assets/TarTrack Logo_sakto.png')} 
                style={styles.loadingLogo}
                resizeMode="contain"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.loadingText, { marginRight: 4 }]}>Loading bookings</Text>
                <Animated.Text style={[styles.loadingText, { opacity: dot1Anim }]}>.</Animated.Text>
                <Animated.Text style={[styles.loadingText, { opacity: dot2Anim }]}>.</Animated.Text>
                <Animated.Text style={[styles.loadingText, { opacity: dot3Anim }]}>.</Animated.Text>
              </View>
            </Animated.View>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>
              {selectedCategory === 'all' ? 'No Bookings Yet' : `No ${categories.find(c => c.id === selectedCategory)?.label} Bookings`}
            </Text>
            <Text style={styles.emptyText}>
              {selectedCategory === 'all' 
                ? 'Your booking history will appear here once you make your first reservation.'
                : `You haven't made any ${categories.find(c => c.id === selectedCategory)?.label.toLowerCase()} bookings yet.`
              }
            </Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {filteredBookings.map(renderBooking)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    backgroundColor: MAROON,
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: MAROON,
    backgroundColor: '#fff',
    minWidth: 80,
  },
  categoryBtnActive: {
    backgroundColor: MAROON,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: MAROON,
    marginLeft: 4,
    marginRight: 4,
  },
  categoryTextActive: {
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: MAROON,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  categoryBadgeActive: {
    backgroundColor: '#fff',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryBadgeTextActive: {
    color: MAROON,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // marginTop: 100
  },
  loadingLogo: {
    width: 230,
    height: 230,
    marginBottom: -90,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bookingsList: {
    gap: 16,
  },
  bookingCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bookingDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  packageDetail: {
    fontSize: 12,
    color: '#666',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  driverName: {
    fontSize: 12,
    color: MAROON,
    fontWeight: '500',
  },
  reviewSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reviewHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewStatus: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewItemText: {
    fontSize: 12,
    color: '#666',
  },
  reviewItemCompleted: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  reviewButton: {
    backgroundColor: MAROON,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  reviewCompletedText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '500',
  },
});
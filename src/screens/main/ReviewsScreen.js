import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { getUserReviews } from '../../services/reviews';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

function ReviewsScreen({ navigation }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('given');
  const isTourist = user?.role === 'tourist';
  const isDriverOrOwner = user?.role === 'driver' || user?.role === 'driver-owner' || user?.role === 'owner';
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Animation refs for loading
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  const fetchReviews = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getUserReviews({
        user_id: user?.id,
        type: activeTab,
        limit: 50,
        user_role: user?.role
      });

      if (result.success) {
        setReviews(result.data || []);
        setStats(result.stats || null);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [activeTab, user]);

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
    fetchReviews(true);
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? '#FFD700' : '#DDD'}
        />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const renderReview = (review, index) => {
    const isPackageReview = !!review.package_id;
    const isDriverReview = !!review.driver_id;
    
    return (
      <View key={index} style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewInfo}>
            <Text style={styles.reviewerName}>
              {activeTab === 'received' 
                ? (review.reviewer_name || 'Anonymous User')
                : isDriverReview
                  ? (review.driver_name || 'Driver')
                  : (review.package_name || 'Tour Package')
              }
            </Text>
            {renderStars(review.rating)}
          </View>
          <Text style={styles.reviewDate}>
            {new Date(review.created_at).toLocaleDateString()}
          </Text>
        </View>
        
        {review.comment && (
          <Text style={styles.reviewComment}>{review.comment}</Text>
        )}
        
        <View style={styles.reviewType}>
          <Ionicons 
            name={isDriverReview ? 'person' : 'location'} 
            size={12} 
            color="#999" 
          />
          <Text style={styles.reviewTypeText}>
            {isDriverReview ? 'Driver Review' : 'Package Review'}
          </Text>
        </View>
      </View>
    );
  }

  const renderStats = () => {
    if (!stats || activeTab !== 'received') return null;
    
    return (
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.average_rating?.toFixed(1) || '0.0'}</Text>
          <Text style={styles.statLabel}>Average Rating</Text>
          {renderStars(Math.round(stats.average_rating || 0))}
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.review_count || 0}</Text>
          <Text style={styles.statLabel}>Total Reviews</Text>
        </View>
      </View>
    );
  };

  const canReceiveReviews = user?.role === 'driver' || user?.role === 'owner';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.hero}>
        <TARTRACKHeader
          onMessagePress={() => navigation.navigate('Chat')}
          onNotificationPress={() => navigation.navigate('Notification')}
        />
      </View>

      {/* Floating title card */}
      <View style={styles.titleCard}>
        <View style={styles.titleCenter}>
          <Ionicons name="star-outline" size={24} color="#6B2E2B" />
          <Text style={styles.titleText}>Reviews</Text>
        </View>
      </View>



      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderStats()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
              <Image 
                source={require('../../../assets/TarTrack Logo_sakto.png')} 
                style={styles.loadingLogo}
                resizeMode="contain"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.loadingText, { marginRight: 4 }]}>Loading reviews</Text>
                <Animated.Text style={[styles.loadingText, { opacity: dot1Anim }]}>.</Animated.Text>
                <Animated.Text style={[styles.loadingText, { opacity: dot2Anim }]}>.</Animated.Text>
                <Animated.Text style={[styles.loadingText, { opacity: dot3Anim }]}>.</Animated.Text>
              </View>
            </Animated.View>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyText}>
              {isTourist
                ? 'You haven\'t submitted any reviews yet. Complete a tour or ride to leave your first review!'
                : 'You haven\'t received any reviews yet. Complete rides to get reviews from tourists.'}
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map(renderReview)}
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
  hero: {
    backgroundColor: MAROON,
    paddingTop: 6,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  titleCard: {
    marginHorizontal: 16,
    marginTop: -12,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFE7E4',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  titleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: MAROON,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: MAROON,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#EEE',
    marginHorizontal: 20,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  packageInfo: {
    fontSize: 12,
    color: MAROON,
    fontWeight: '500',
  },
  reviewType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  reviewTypeText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
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
});

export default ReviewsScreen;
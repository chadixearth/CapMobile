import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { getUserReviews } from '../../services/reviews';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function ReviewsScreen({ navigation }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(user?.role === 'tourist' ? 'given' : 'received');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  const fetchReviews = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getUserReviews({
        user_id: user?.id,
        type: activeTab,
        limit: 50
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

  const renderReview = (review, index) => (
    <View key={index} style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewInfo}>
          <Text style={styles.reviewerName}>
            {activeTab === 'received' 
              ? (review.reviewer_name || 'Anonymous User')
              : (review.driver_name || review.package_name || 'Service')
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
      
      {review.package_name && (
        <Text style={styles.packageInfo}>Package: {review.package_name}</Text>
      )}
    </View>
  );

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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews</Text>
      </View>

      {/* Tabs - Only show for tourists who can both give and receive reviews */}
      {user?.role === 'tourist' && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'received' && styles.activeTab]}
            onPress={() => setActiveTab('received')}
          >
            <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
              Received
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'given' && styles.activeTab]}
            onPress={() => setActiveTab('given')}
          >
            <Text style={[styles.tabText, activeTab === 'given' && styles.activeTabText]}>
              Given
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
            <ActivityIndicator size="large" color={MAROON} />
            <Text style={styles.loadingText}>Loading reviews...</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#DDD" />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'received'
                ? 'You haven\'t received any reviews yet.'
                : 'You haven\'t given any reviews yet.'}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDriverReviews } from '../services/reviews';

const MAROON = '#6B2E2B';

export default function DriverProfileModal({ visible, onClose, driver }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && driver?.id) {
      fetchDriverReviews();
    }
  }, [visible, driver]);

  const fetchDriverReviews = async () => {
    setLoading(true);
    try {
      const result = await getDriverReviews({ driver_id: driver.id, limit: 50 });
      if (result.success) {
        setReviews(result.data || []);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching driver reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="person-circle" size={24} color={MAROON} />
              <Text style={styles.headerTitle}>Driver Profile</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driver?.name || 'Driver'}</Text>
            {stats && (
              <View style={styles.statsRow}>
                {renderStars(Math.round(stats.average_rating || 0))}
                <Text style={styles.ratingText}>
                  {stats.average_rating?.toFixed(1) || '0.0'} ({stats.review_count || 0} reviews)
                </Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Reviews</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={MAROON} />
              <Text style={styles.loadingText}>Loading reviews...</Text>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbox-outline" size={48} color="#DDD" />
              <Text style={styles.emptyText}>No reviews yet</Text>
            </View>
          ) : (
            <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
              {reviews.map((review, index) => (
                <View key={index} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName}>
                      {review.is_anonymous ? 'Anonymous' : review.reviewer_name || 'Tourist'}
                    </Text>
                    {renderStars(review.rating)}
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  driverInfo: {
    padding: 16,
    alignItems: 'center',
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: MAROON,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    padding: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  reviewsList: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  reviewCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewComment: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 11,
    color: '#999',
  },
});

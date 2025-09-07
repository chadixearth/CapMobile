import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const TourPackageModal = ({ visible, onClose, packageData, onBook }) => {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [ratingStats, setRatingStats] = useState({
    totalRatings: 0,
    averageRating: 0,
    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });

  useEffect(() => {
    if (visible && packageData?.id) {
      loadReviews();
    }
  }, [visible, packageData?.id]);

  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      // Get all reviews for stats
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('package_id', packageData.id);
      
      // Get recent reviews for display
      const { data: recentReviews } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, users(name)')
        .eq('package_id', packageData.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      setReviews(recentReviews || []);
      
      // Calculate rating statistics
      if (allReviews && allReviews.length > 0) {
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalRating = 0;
        
        allReviews.forEach(review => {
          breakdown[review.rating]++;
          totalRating += review.rating;
        });
        
        setRatingStats({
          totalRatings: allReviews.length,
          averageRating: totalRating / allReviews.length,
          ratingBreakdown: breakdown
        });
      } else {
        setRatingStats({
          totalRatings: 0,
          averageRating: 0,
          ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  const renderRatingBar = (rating, count) => {
    const percentage = ratingStats.totalRatings > 0 ? (count / ratingStats.totalRatings) * 100 : 0;
    return (
      <View style={styles.ratingBarRow}>
        <Text style={styles.ratingNumber}>{rating}</Text>
        <Ionicons name="star" size={12} color="#FFD700" />
        <View style={styles.ratingBarContainer}>
          <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.ratingCount}>({count})</Text>
      </View>
    );
  };

  const renderReview = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.reviewerAvatar}>
            <Text style={styles.reviewerInitial}>
              {(item.users?.name || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.reviewerName}>{item.users?.name || 'Anonymous'}</Text>
            <View style={styles.starsRow}>{renderStars(item.rating)}</View>
          </View>
        </View>
        <Text style={styles.reviewDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      {item.comment && <Text style={styles.reviewComment}>{item.comment}</Text>}
    </View>
  );

  if (!packageData) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tour Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Package Image */}
          <View style={styles.imageContainer}>
            {packageData.photos && packageData.photos.length > 0 ? (
              <Image source={{ uri: packageData.photos[0] }} style={styles.packageImage} />
            ) : (
              <Image
                source={require('../../assets/images/tourA.png')}
                style={styles.packageImage}
              />
            )}
          </View>

          {/* Package Info */}
          <View style={styles.infoCard}>
            <Text style={styles.packageTitle}>{packageData.package_name}</Text>
            <Text style={styles.packagePrice}>₱{packageData.price?.toLocaleString()}</Text>
            
            <View style={styles.metaRow}>
              {packageData.duration_hours && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color="#6B2E2B" />
                  <Text style={styles.metaText}>{packageData.duration_hours} hours</Text>
                </View>
              )}
              {packageData.max_pax && (
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={16} color="#6B2E2B" />
                  <Text style={styles.metaText}>Max {packageData.max_pax} pax</Text>
                </View>
              )}
              {packageData.average_rating && (
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.metaText}>{packageData.average_rating.toFixed(1)}</Text>
                </View>
              )}
            </View>

            {packageData.description && (
              <Text style={styles.description}>{packageData.description}</Text>
            )}
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsCard}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewsTitle}>Reviews & Ratings</Text>
              {loadingReviews && <ActivityIndicator size="small" color="#6B2E2B" />}
            </View>

            {ratingStats.totalRatings > 0 ? (
              <>
                {/* Rating Summary */}
                <View style={styles.ratingSummary}>
                  <View style={styles.averageRatingSection}>
                    <Text style={styles.averageRatingNumber}>
                      {ratingStats.averageRating.toFixed(1)}
                    </Text>
                    <View style={styles.averageStars}>
                      {renderStars(Math.round(ratingStats.averageRating))}
                    </View>
                    <Text style={styles.totalRatingsText}>
                      Based on {ratingStats.totalRatings} review{ratingStats.totalRatings !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  
                  <View style={styles.ratingBreakdown}>
                    {[5, 4, 3, 2, 1].map(rating => 
                      renderRatingBar(rating, ratingStats.ratingBreakdown[rating])
                    )}
                  </View>
                </View>

                {/* Recent Reviews */}
                {reviews.length > 0 && (
                  <>
                    <View style={styles.recentReviewsHeader}>
                      <Text style={styles.recentReviewsTitle}>Recent Reviews</Text>
                    </View>
                    <FlatList
                      data={reviews}
                      renderItem={renderReview}
                      keyExtractor={(item) => item.id.toString()}
                      scrollEnabled={false}
                      ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                  </>
                )}
              </>
            ) : (
              <Text style={styles.noReviews}>No reviews yet. Be the first to review!</Text>
            )}
          </View>
        </ScrollView>

        {/* Book Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.bookButton, !packageData.is_active && styles.bookButtonDisabled]}
            onPress={() => {
              onClose();
              onBook();
            }}
            disabled={!packageData.is_active}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.bookButtonText}>
              {packageData.is_active ? 'Book Now' : 'Unavailable'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  packageImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6B2E2B',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  reviewsCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingSummary: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  averageRatingSection: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 16,
  },
  averageRatingNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  averageStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  totalRatingsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  ratingBreakdown: {
    flex: 1.5,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingNumber: {
    fontSize: 12,
    color: '#666',
    width: 12,
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
  },
  ratingCount: {
    fontSize: 10,
    color: '#999',
    width: 24,
    textAlign: 'right',
  },
  recentReviewsHeader: {
    marginBottom: 12,
  },
  recentReviewsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reviewItem: {
    paddingVertical: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B2E2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewerInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: 'row',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: '#999',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  noReviews: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  bookButton: {
    backgroundColor: '#6B2E2B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default TourPackageModal;
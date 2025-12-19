import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { createPackageReview, createDriverReview, createRideHailingDriverReview, checkExistingReviews, listReviews } from '../../services/reviews';
import { getAnonymousReviewSetting } from '../../services/userSettings';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function ReviewSubmissionScreen({ navigation, route }) {
  const { user } = useAuth();
  const { booking, package: tourPackage, driver, rideBooking, bookingType = 'tour' } = route.params || {};
  
  const [packageRating, setPackageRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [packageComment, setPackageComment] = useState('');
  const [driverComment, setDriverComment] = useState('');
  const [packageAnonymous, setPackageAnonymous] = useState(false);
  const [driverAnonymous, setDriverAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingPackageReview, setExistingPackageReview] = useState(null);
  const [existingDriverReview, setExistingDriverReview] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoadingReviews(true);
      
      // Load user's anonymous preference
      try {
        const result = await getAnonymousReviewSetting();
        if (result.success) {
          setPackageAnonymous(result.data.isAnonymous);
          setDriverAnonymous(result.data.isAnonymous);
        }
      } catch (error) {
        console.error('Error loading anonymous setting:', error);
      }
      
      // Check for existing reviews
      if (booking?.id && user?.id) {
        try {
          const reviewsResult = await listReviews({
            booking_id: booking.id,
            reviewer_id: user.id
          });
          
          if (reviewsResult.success && reviewsResult.data) {
            const packageReview = reviewsResult.data.find(r => r.package_id);
            const driverReview = reviewsResult.data.find(r => r.driver_id);
            
            if (packageReview) {
              setExistingPackageReview(packageReview);
              setPackageRating(packageReview.rating);
              setPackageComment(packageReview.comment || '');
              setPackageAnonymous(packageReview.is_anonymous || false);
            }
            
            if (driverReview) {
              setExistingDriverReview(driverReview);
              setDriverRating(driverReview.rating);
              setDriverComment(driverReview.comment || '');
              setDriverAnonymous(driverReview.is_anonymous || false);
            }
          }
        } catch (error) {
          console.error('Error loading existing reviews:', error);
        }
      }
      
      setLoadingReviews(false);
    };
    
    loadData();
  }, [booking?.id, user?.id]);

  const renderStars = (rating, onPress, disabled = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={disabled ? undefined : () => onPress(i)}
          style={[styles.starButton, disabled && styles.starButtonDisabled]}
          activeOpacity={disabled ? 1 : 0.7}
          disabled={disabled}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={32}
            color={i <= rating ? '#FFD700' : '#DDD'}
          />
        </TouchableOpacity>
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  const handleSubmit = async () => {
    // Check if reviews already exist
    if (existingPackageReview || existingDriverReview) {
      Alert.alert('Review Already Submitted', 'You have already submitted a review for this booking.');
      return;
    }
    
    if (packageRating === 0 && driverRating === 0) {
      Alert.alert('Rating Required', 'Please provide at least one rating before submitting.');
      return;
    }

    console.log('[ReviewSubmissionScreen] Submitting reviews with anonymous flags:');
    console.log('Package anonymous:', packageAnonymous, 'type:', typeof packageAnonymous);
    console.log('Driver anonymous:', driverAnonymous, 'type:', typeof driverAnonymous);

    setLoading(true);
    
    try {
      const results = [];
      
      // Submit package review if rating provided (tour bookings only)
      if (packageRating > 0 && bookingType === 'tour') {
        console.log('[ReviewSubmissionScreen] Submitting package review with is_anonymous:', packageAnonymous);
        const packageResult = await createPackageReview({
          package_id: tourPackage?.id || booking?.package_id || booking?.package_data?.id,
          booking_id: booking?.id,
          reviewer_id: user?.id,
          rating: packageRating,
          comment: packageComment.trim(),
          is_anonymous: packageAnonymous,
        });
        results.push({ type: 'package', result: packageResult });
      }
      
      // Submit driver review
      if (driverRating > 0) {
        console.log('[ReviewSubmissionScreen] Submitting driver review with is_anonymous:', driverAnonymous);
        let driverResult;
        if (bookingType === 'ride_hailing') {
          driverResult = await createRideHailingDriverReview({
            driver_id: driver?.id || rideBooking?.driver_id,
            ride_booking_id: rideBooking?.id,
            reviewer_id: user?.id,
            rating: driverRating,
            comment: driverComment.trim(),
            is_anonymous: driverAnonymous,
          });
        } else {
          driverResult = await createDriverReview({
            driver_id: driver?.id || booking?.driver_id || booking?.assigned_driver_id,
            booking_id: booking?.id,
            reviewer_id: user?.id,
            rating: driverRating,
            comment: driverComment.trim(),
            is_anonymous: driverAnonymous,
          });
        }
        results.push({ type: 'driver', result: driverResult });
      }
      
      // Check if all submissions were successful
      const failures = results.filter(r => !r.result.success);
      
      if (failures.length === 0) {
        Alert.alert(
          'Thank You!',
          'Your review has been submitted successfully.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const errorMessages = failures.map(f => 
          `${f.type} review: ${f.result.error}`
        ).join('\n');
        Alert.alert('Submission Error', errorMessages);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit reviews. Please try again.');
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headerTitle}>Rate Your Experience</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Package Review */}
        {(tourPackage || booking?.package_name || booking?.package_data) && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Ionicons name="location" size={20} color={MAROON} />
              <Text style={styles.reviewTitle}>Rate the Tour Package</Text>
            </View>
            <Text style={styles.packageName}>{tourPackage?.name || tourPackage?.package_name || booking?.package_name || booking?.package_data?.package_name || 'Tour Package'}</Text>
            
            {existingPackageReview && (
              <View style={styles.existingReviewBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.existingReviewText}>Review already submitted</Text>
              </View>
            )}
            
            {renderStars(packageRating, setPackageRating, !!existingPackageReview)}
            
            <TextInput
              style={[styles.commentInput, existingPackageReview && styles.commentInputDisabled]}
              value={packageComment}
              onChangeText={existingPackageReview ? undefined : setPackageComment}
              placeholder={existingPackageReview ? "" : "Share your experience with this tour package..."}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!existingPackageReview}
            />
            
            <TouchableOpacity
              style={[styles.anonymousToggle, existingPackageReview && styles.anonymousToggleDisabled]}
              onPress={existingPackageReview ? undefined : () => setPackageAnonymous(!packageAnonymous)}
              activeOpacity={existingPackageReview ? 1 : 0.7}
              disabled={!!existingPackageReview}
            >
              <Ionicons
                name={packageAnonymous ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={packageAnonymous ? MAROON : '#999'}
              />
              <Text style={styles.anonymousText}>Post as Anonymous</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Driver Review */}
        {(driver || booking?.driver_id || booking?.assigned_driver_id) && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Ionicons name="person" size={20} color={MAROON} />
              <Text style={styles.reviewTitle}>Rate the Driver</Text>
            </View>
            <Text style={styles.driverName}>{driver?.name || booking?.driver_name || 'Your Driver'}</Text>
            
            {existingDriverReview && (
              <View style={styles.existingReviewBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.existingReviewText}>Review already submitted</Text>
              </View>
            )}
            
            {renderStars(driverRating, setDriverRating, !!existingDriverReview)}
            
            <TextInput
              style={[styles.commentInput, existingDriverReview && styles.commentInputDisabled]}
              value={driverComment}
              onChangeText={existingDriverReview ? undefined : setDriverComment}
              placeholder={existingDriverReview ? "" : "How was your experience with the driver?"}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!existingDriverReview}
            />
            
            <TouchableOpacity
              style={[styles.anonymousToggle, existingDriverReview && styles.anonymousToggleDisabled]}
              onPress={existingDriverReview ? undefined : () => {
                const newValue = !driverAnonymous;
                console.log('[ReviewSubmissionScreen] Driver anonymous toggle:', driverAnonymous, '->', newValue);
                setDriverAnonymous(newValue);
              }}
              activeOpacity={existingDriverReview ? 1 : 0.7}
              disabled={!!existingDriverReview}
            >
              <Ionicons
                name={driverAnonymous ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={driverAnonymous ? MAROON : '#999'}
              />
              <Text style={styles.anonymousText}>Post as Anonymous</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons - Only for tourists */}
        {user?.role === 'tourist' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || (existingPackageReview && existingDriverReview)) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={loading || (existingPackageReview && existingDriverReview)}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (existingPackageReview && existingDriverReview) ? (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.submitButtonText}>Already Reviewed</Text>
                </>
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => navigation.navigate('ReportDriver', { booking })}
              activeOpacity={0.8}
            >
              <Ionicons name="flag-outline" size={16} color="#DC3545" />
              <Text style={styles.reportButtonText}>Report Driver</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
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
  content: {
    flex: 1,
    padding: 16,
  },

  reviewCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  packageName: {
    fontSize: 14,
    color: MAROON,
    fontWeight: '500',
    marginBottom: 16,
  },
  driverName: {
    fontSize: 14,
    color: MAROON,
    fontWeight: '500',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: MAROON,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DC3545',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reportButtonText: {
    color: '#DC3545',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  anonymousText: {
    fontSize: 14,
    color: '#666',
  },
  existingReviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  existingReviewText: {
    fontSize: 12,
    color: '#155724',
    fontWeight: '600',
  },
  starButtonDisabled: {
    opacity: 0.6,
  },
  commentInputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
    opacity: 0.8,
  },
  anonymousToggleDisabled: {
    opacity: 0.6,
  },
});
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
import { createPackageReview, createDriverReview, createRideHailingDriverReview } from '../../services/reviews';
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
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load user's anonymous preference
    const loadAnonymousSetting = async () => {
      try {
        const result = await getAnonymousReviewSetting();
        if (result.success) {
          setIsAnonymous(result.data.isAnonymous);
        }
      } catch (error) {
        console.error('Error loading anonymous setting:', error);
      }
    };
    
    loadAnonymousSetting();
  }, []);

  const renderStars = (rating, onPress) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => onPress(i)}
          style={styles.starButton}
          activeOpacity={0.7}
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
    if (packageRating === 0 && driverRating === 0) {
      Alert.alert('Rating Required', 'Please provide at least one rating before submitting.');
      return;
    }

    setLoading(true);
    
    try {
      const results = [];
      
      // Submit package review if rating provided (tour bookings only)
      if (packageRating > 0 && bookingType === 'tour') {
        const packageResult = await createPackageReview({
          package_id: tourPackage?.id,
          booking_id: booking?.id,
          reviewer_id: user?.id,
          rating: packageRating,
          comment: packageComment.trim(),
          is_anonymous: isAnonymous,
        });
        results.push({ type: 'package', result: packageResult });
      }
      
      // Submit driver review
      if (driverRating > 0) {
        let driverResult;
        if (bookingType === 'ride_hailing') {
          driverResult = await createRideHailingDriverReview({
            driver_id: driver?.id || rideBooking?.driver_id,
            ride_booking_id: rideBooking?.id,
            reviewer_id: user?.id,
            rating: driverRating,
            comment: driverComment.trim(),
            is_anonymous: isAnonymous,
          });
        } else {
          driverResult = await createDriverReview({
            driver_id: driver?.id,
            booking_id: booking?.id,
            reviewer_id: user?.id,
            rating: driverRating,
            comment: driverComment.trim(),
            is_anonymous: isAnonymous,
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
        {/* Anonymous Option */}
        <View style={styles.anonymousCard}>
          <View style={styles.anonymousHeader}>
            <View style={styles.anonymousIconCircle}>
              <Ionicons name="eye-off" size={18} color={MAROON} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.anonymousTitle}>Anonymous Review</Text>
              <Text style={styles.anonymousSubtitle}>
                Your name won't be shown with this review
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.anonymousToggle,
                isAnonymous && styles.anonymousToggleActive
              ]}
              onPress={() => setIsAnonymous(!isAnonymous)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.anonymousToggleThumb,
                isAnonymous && styles.anonymousToggleThumbActive
              ]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Package Review */}
        {tourPackage && bookingType === 'tour' && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Ionicons name="location" size={20} color={MAROON} />
              <Text style={styles.reviewTitle}>Rate the Tour Package</Text>
            </View>
            <Text style={styles.packageName}>{tourPackage.name}</Text>
            
            {renderStars(packageRating, setPackageRating)}
            
            <TextInput
              style={styles.commentInput}
              value={packageComment}
              onChangeText={setPackageComment}
              placeholder="Share your experience with this tour package..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Driver Review */}
        {(driver || (rideBooking && rideBooking.driver_id)) && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Ionicons name="person" size={20} color={MAROON} />
              <Text style={styles.reviewTitle}>Rate the Driver</Text>
            </View>
            <Text style={styles.driverName}>{driver.name || 'Your Driver'}</Text>
            
            {renderStars(driverRating, setDriverRating)}
            
            <TextInput
              style={styles.commentInput}
              value={driverComment}
              onChangeText={setDriverComment}
              placeholder="How was your experience with the driver?"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            loading && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </>
          )}
        </TouchableOpacity>

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
  anonymousCard: {
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
  anonymousHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  anonymousIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDF4F4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3DADA',
  },
  anonymousTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  anonymousSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  anonymousToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  anonymousToggleActive: {
    backgroundColor: MAROON,
  },
  anonymousToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  anonymousToggleThumbActive: {
    transform: [{ translateX: 20 }],
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
  submitButton: {
    backgroundColor: MAROON,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
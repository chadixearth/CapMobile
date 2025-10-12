import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPackageBookings, acceptPackageBooking, getPackageReviews } from '../../services/tourPackageService';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function PackageDetailsScreen({ navigation, route }) {
  const { package: pkg } = route.params;
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('bookings');

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [bookingsResult, reviewsResult] = await Promise.all([
        getPackageBookings(pkg.id),
        getPackageReviews(pkg.id)
      ]);

      if (bookingsResult.success) {
        setBookings(bookingsResult.data || []);
      }

      if (reviewsResult.success) {
        setReviews(reviewsResult.data || []);
        setReviewStats(reviewsResult.stats);
      }
    } catch (error) {
      console.error('Error fetching package data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAcceptBooking = async (bookingId) => {
    try {
      const result = await acceptPackageBooking(bookingId);
      if (result.success) {
        Alert.alert('Success', 'Booking accepted successfully');
        fetchData();
      } else {
        Alert.alert('Error', result.error || 'Failed to accept booking');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept booking');
    }
  };

  const renderBooking = (booking, index) => (
    <View key={index} style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingRef}>#{booking.booking_reference}</Text>
        <View style={[styles.statusBadge, getStatusStyle(booking.status)]}>
          <Text style={[styles.statusText, getStatusTextStyle(booking.status)]}>
            {booking.status?.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <Text style={styles.customerName}>{booking.customer_name || 'Customer'}</Text>
        <Text style={styles.bookingInfo}>
          {booking.number_of_pax} pax • ₱{booking.total_amount}
        </Text>
        <Text style={styles.bookingDate}>
          {new Date(booking.booking_date).toLocaleDateString()} at {booking.pickup_time || pkg.start_time || 'TBD'}
        </Text>
        {booking.special_requests && (
          <Text style={styles.specialRequests}>Note: {booking.special_requests}</Text>
        )}
      </View>

      {booking.status === 'pending' && (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptBooking(booking.id)}
        >
          <Text style={styles.acceptButtonText}>Accept Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReview = (review, index) => (
    <View key={index} style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewerName}>
          {review.is_anonymous ? 'Anonymous' : review.reviewer_name || 'Customer'}
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= review.rating ? 'star' : 'star-outline'}
              size={16}
              color="#FFD700"
            />
          ))}
        </View>
      </View>
      {review.comment && (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      )}
      <Text style={styles.reviewDate}>
        {new Date(review.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return { backgroundColor: '#FFF3CD' };
      case 'driver_assigned': return { backgroundColor: '#D4EDDA' };
      case 'completed': return { backgroundColor: '#E8F5E8' };
      case 'cancelled': return { backgroundColor: '#F8D7DA' };
      default: return { backgroundColor: '#E9ECEF' };
    }
  };

  const getStatusTextStyle = (status) => {
    switch (status) {
      case 'pending': return { color: '#856404' };
      case 'driver_assigned': return { color: '#155724' };
      case 'completed': return { color: '#28A745' };
      case 'cancelled': return { color: '#721C24' };
      default: return { color: '#495057' };
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {pkg.package_name}
        </Text>
      </View>

      {/* Package Info */}
      <View style={styles.packageInfo}>
        <Text style={styles.packagePrice}>₱{pkg.price}</Text>
        <Text style={styles.packageDetails}>
          {pkg.duration_hours}h • {pkg.max_pax} pax{pkg.start_time ? ` • Starts at ${pkg.start_time}` : ''}
        </Text>
        {(pkg.pickup_location || pkg.destination) && (
          <TouchableOpacity
            style={styles.viewRouteButton}
            onPress={() => navigation.navigate('MapView', {
              mode: 'viewRoute',
              locations: {
                pickup: {
                  name: pkg.pickup_location,
                  latitude: pkg.pickup_lat || 10.3157,
                  longitude: pkg.pickup_lng || 123.8854
                },
                destination: {
                  name: pkg.destination,
                  latitude: pkg.dropoff_lat || 10.3157,
                  longitude: pkg.dropoff_lng || 123.8854
                }
              }
            })}
          >
            <Ionicons name="map-outline" size={16} color={MAROON} />
            <Text style={styles.viewRouteText}>View Route on Map</Text>
          </TouchableOpacity>
        )}
        {reviewStats && (
          <View style={styles.reviewSummary}>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= Math.round(reviewStats.average_rating) ? 'star' : 'star-outline'}
                  size={16}
                  color="#FFD700"
                />
              ))}
            </View>
            <Text style={styles.reviewCount}>
              {reviewStats.average_rating?.toFixed(1)} ({reviewStats.review_count} reviews)
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookings' && styles.activeTab]}
          onPress={() => setActiveTab('bookings')}
        >
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.activeTabText]}>
            Bookings ({bookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
            Reviews ({reviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={MAROON} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : activeTab === 'bookings' ? (
          bookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#DDD" />
              <Text style={styles.emptyTitle}>No Bookings Yet</Text>
              <Text style={styles.emptyText}>
                Bookings for this package will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {bookings.map(renderBooking)}
            </View>
          )
        ) : (
          reviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color="#DDD" />
              <Text style={styles.emptyTitle}>No Reviews Yet</Text>
              <Text style={styles.emptyText}>
                Customer reviews will appear here after completed bookings.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {reviews.map(renderReview)}
            </View>
          )
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  packageInfo: {
    backgroundColor: CARD,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: '700',
    color: MAROON,
  },
  packageDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    backgroundColor: CARD,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: MAROON,
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: MAROON,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    gap: 12,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingRef: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookingInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  specialRequests: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  acceptButton: {
    backgroundColor: MAROON,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#888',
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
  viewRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewRouteText: {
    fontSize: 14,
    color: MAROON,
    marginLeft: 6,
    fontWeight: '500',
  },
});
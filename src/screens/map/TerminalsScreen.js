import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafletMapView from '../../components/LeafletMapView';
import BackButton from '../../components/BackButton';
import RideStatusCard from '../../components/RideStatusCard';
import { getMyActiveRides, getMyRideHistory } from '../../services/rideHailingService';
import { getCurrentUser } from '../../services/authService';
import { fetchTerminals, fetchMapData } from '../../services/map/fetchMap';
import { fetchRouteSummaries, processMapPointsWithColors, processRoadHighlightsWithColors } from '../../services/routeManagementService';
import { getAllRoadHighlightsWithPoints, processRoadHighlightsForMap } from '../../services/roadHighlightsService';
import { useAuth } from '../../hooks/useAuth';
import { createRideHailingDriverReview, checkExistingReviews } from '../../services/reviews';
import { subscribeToDataChanges, DATA_EVENTS } from '../../services/dataInvalidationService';
import { useFocusEffect } from '@react-navigation/native';

const DEFAULT_REGION = {
  latitude: 10.307,
  longitude: 123.9,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const TerminalsScreen = ({ navigation, route }) => {
  const { role } = useAuth();
  const type = route?.params?.type || 'pickup';
  const [selectedId, setSelectedId] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [rideHistory, setRideHistory] = useState([]);
  const [showRides, setShowRides] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [terminals, setTerminals] = useState([]);
  const [mapData, setMapData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [ratingModal, setRatingModal] = useState({ visible: false, ride: null });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [reviewedRides, setReviewedRides] = useState(new Set());

  useFocusEffect(
    React.useCallback(() => {
      if (role === 'tourist') {
        console.log('[TerminalsScreen] Screen focused, refreshing rides');
        fetchActiveRides();
        fetchRideHistory();
      }
    }, [role])
  );

  useEffect(() => {
    if (role === 'tourist') {
      fetchActiveRides();
      fetchRideHistory();
      
      // Poll for ride status changes every 5 seconds
      const pollInterval = setInterval(() => {
        fetchActiveRides();
      }, 5000);
      
      return () => clearInterval(pollInterval);
    }
    loadMapData();
  }, [role]);

  const loadMapData = async () => {
    try {
      const data = await fetchMapData({ forceRefresh: true });
      const roadHighlightsResult = await getAllRoadHighlightsWithPoints();
      
      let allPointsToShow = [];
      
      if (data.points && data.points.length > 0) {
        const processedMarkers = data.points.map(point => ({
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          title: point.name,
          description: point.description || '',
          pointType: point.point_type,
          iconColor: point.stroke_color || point.icon_color || '#FF0000',
          id: point.id,
          image_urls: point.image_urls || []
        }));
        allPointsToShow = [...processedMarkers];
      }
      
      const pickupColorMap = {};
      const dropoffColorMap = {};
      
      if (roadHighlightsResult && roadHighlightsResult.roadHighlights) {
        roadHighlightsResult.roadHighlights.forEach(road => {
          if (road.pickup_point_id && road.stroke_color) {
            pickupColorMap[road.pickup_point_id] = road.stroke_color;
          }
          if (road.dropoff_point_id && road.stroke_color) {
            dropoffColorMap[road.dropoff_point_id] = road.stroke_color;
          }
        });
      }
      
      if (roadHighlightsResult && roadHighlightsResult.pickupPoints) {
        const pickupMarkers = roadHighlightsResult.pickupPoints.map(pickup => ({
          latitude: parseFloat(pickup.latitude),
          longitude: parseFloat(pickup.longitude),
          title: pickup.name,
          description: 'Pickup Point',
          pointType: 'pickup',
          iconColor: pickupColorMap[pickup.id] || pickup.stroke_color || pickup.icon_color || '#2E7D32',
          id: pickup.id,
          image_urls: pickup.image_urls || []
        }));
        allPointsToShow = [...allPointsToShow, ...pickupMarkers];
      }
      
      if (roadHighlightsResult && roadHighlightsResult.dropoffPoints) {
        const dropoffMarkers = roadHighlightsResult.dropoffPoints.map(dropoff => ({
          latitude: parseFloat(dropoff.latitude),
          longitude: parseFloat(dropoff.longitude),
          title: dropoff.name,
          description: 'Drop-off Point',
          pointType: 'dropoff',
          iconColor: dropoffColorMap[dropoff.id] || dropoff.stroke_color || dropoff.icon_color || '#C62828',
          id: dropoff.id,
          image_urls: dropoff.image_urls || []
        }));
        allPointsToShow = [...allPointsToShow, ...dropoffMarkers];
      }
      
      setTerminals(allPointsToShow);
      
      let processedRoads = [];
      if (roadHighlightsResult && roadHighlightsResult.success && roadHighlightsResult.roadHighlights.length > 0) {
        processedRoads = processRoadHighlightsForMap(roadHighlightsResult.roadHighlights);
      } else if (data.roads && data.roads.length > 0) {
        processedRoads = data.roads.map(road => ({
          id: road.id,
          name: road.name,
          road_coordinates: road.road_coordinates || [],
          stroke_color: road.stroke_color || '#007AFF',
          stroke_width: road.stroke_width || 4,
          stroke_opacity: road.stroke_opacity || 0.7,
          highlight_type: road.highlight_type || 'available'
        }));
      }
      
      setMapData({ ...data, roads: processedRoads });
    } catch (error) {
      console.error('[TerminalsScreen] Error loading map data:', error);
      setTerminals([]);
      setMapData({ points: [], roads: [], routes: [], zones: [] });
    }
  };

  const fetchActiveRides = async () => {
    try {
      const user = currentUser || await getCurrentUser();
      if (!currentUser) setCurrentUser(user);
      
      if (user?.id) {
        const result = await getMyActiveRides(user.id);
        if (result.success) {
          const newActiveRides = result.data || [];
          
          // Check if any rides changed to completed
          if (activeRides.length > 0) {
            activeRides.forEach(oldRide => {
              const stillActive = newActiveRides.find(r => r.id === oldRide.id);
              if (!stillActive && (oldRide.status === 'in_progress' || oldRide.status === 'driver_assigned')) {
                // Ride was active but now missing - likely completed
                console.log('[TerminalsScreen] Ride completed detected:', oldRide.id);
                handleRideRefresh({ ...oldRide, status: 'completed' });
              }
            });
          }
          
          setActiveRides(newActiveRides);
        }
      }
    } catch (error) {
      console.error('Error fetching active rides:', error);
    }
  };

  const fetchRideHistory = async () => {
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        const result = await getMyRideHistory(user.id);
        if (result.success) {
          setRideHistory(result.data || []);
          // Check which rides have been reviewed
          const reviewed = new Set();
          for (const ride of result.data || []) {
            if (ride.status === 'completed' && ride.driver_id) {
              const check = await checkExistingReviews({
                booking_id: ride.id,
                reviewer_id: user.id
              });
              if (check.success && check.data?.hasDriverReview) {
                reviewed.add(ride.id);
              }
            }
          }
          setReviewedRides(reviewed);
        }
      }
    } catch (error) {
      console.error('Error fetching ride history:', error);
    }
  };

  const handleRideRefresh = (updatedRide) => {
    console.log('[TerminalsScreen] Ride refresh:', updatedRide.status);
    if (updatedRide.status === 'cancelled' || updatedRide.status === 'completed') {
      setActiveRides(prev => prev.filter(ride => ride.id !== updatedRide.id));
      
      if (updatedRide.status === 'completed' && updatedRide.driver_id) {
        // Show review modal immediately
        Alert.alert(
          'Ride Completed! 🎉',
          'Your ride has been completed successfully. Please rate your driver.',
          [{ text: 'OK', onPress: () => {
            setRatingModal({ visible: true, ride: updatedRide });
            setRating(5);
            setComment('');
          }}]
        );
      }
      
      // Refresh history after a short delay
      setTimeout(() => fetchRideHistory(), 1000);
    } else {
      setActiveRides(prev => 
        prev.map(ride => ride.id === updatedRide.id ? updatedRide : ride)
      );
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingModal.ride || !currentUser) {
      Alert.alert('Error', 'Missing ride or user information');
      return;
    }
    
    try {
      setSubmittingRating(true);
      console.log('Submitting review:', {
        driver_id: ratingModal.ride.driver_id,
        ride_booking_id: ratingModal.ride.id,
        reviewer_id: currentUser.id,
        rating
      });
      
      const result = await createRideHailingDriverReview({
        driver_id: ratingModal.ride.driver_id,
        ride_booking_id: ratingModal.ride.id,
        reviewer_id: currentUser.id,
        rating,
        comment: comment.trim(),
        is_anonymous: false
      });
      
      console.log('Review result:', result);
      
      if (result.success) {
        Alert.alert('Thank You!', 'Your rating has been submitted.');
        setRatingModal({ visible: false, ride: null });
        setReviewedRides(prev => new Set([...prev, ratingModal.ride.id]));
      } else {
        Alert.alert('Error', result.error || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Review error:', error);
      Alert.alert('Error', error.message || 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleMarkerPress = (terminal) => {
    setSelectedId(terminal.id);
    navigation.navigate('Home', { selectedTerminal: terminal, type });
  };

  const isTab = navigation.getState && navigation.getState().routes[navigation.getState().index]?.name === 'Terminals';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleButton, !showRides && !showHistory && styles.activeToggle]}
          onPress={() => { setShowRides(false); setShowHistory(false); }}
        >
          <Ionicons name="map-outline" size={20} color={!showRides && !showHistory ? '#fff' : '#6B2E2B'} />
          <Text style={[styles.toggleText, !showRides && !showHistory && styles.activeToggleText]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, showRides && styles.activeToggle]}
          onPress={() => { setShowRides(true); setShowHistory(false); }}
        >
          <Ionicons name="car-outline" size={20} color={showRides ? '#fff' : '#6B2E2B'} />
          <Text style={[styles.toggleText, showRides && styles.activeToggleText]}>Active</Text>
          {activeRides.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{String(activeRides.length)}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, showHistory && styles.activeToggle]}
          onPress={() => { setShowRides(false); setShowHistory(true); }}
        >
          <Ionicons name="time-outline" size={20} color={showHistory ? '#fff' : '#6B2E2B'} />
          <Text style={[styles.toggleText, showHistory && styles.activeToggleText]}>History</Text>
        </TouchableOpacity>
      </View>

      {showHistory ? (
        <View style={styles.ridesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6B2E2B" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : rideHistory.length > 0 ? (
            <ScrollView 
              style={styles.ridesList}
              contentContainerStyle={styles.ridesContent}
              showsVerticalScrollIndicator={false}
            >
              {rideHistory.map(ride => (
                <View key={ride.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Ionicons 
                      name={ride.status === 'completed' ? 'checkmark-circle' : 'close-circle'} 
                      size={24} 
                      color={ride.status === 'completed' ? '#2E7D32' : '#C62828'} 
                    />
                    <Text style={styles.historyStatus}>
                      {ride.status === 'completed' ? 'Completed' : 'Cancelled'}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(ride.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.historyDetails}>
                    <View style={styles.historyRow}>
                      <Ionicons name="location" size={16} color="#666" />
                      <Text style={styles.historyText}>{ride.pickup_address}</Text>
                    </View>
                    <View style={styles.historyRow}>
                      <Ionicons name="flag" size={16} color="#666" />
                      <Text style={styles.historyText}>{ride.dropoff_address}</Text>
                    </View>
                    {ride.driver_name && (
                      <View style={styles.historyRow}>
                        <Ionicons name="person" size={16} color="#666" />
                        <Text style={styles.historyText}>Driver: {ride.driver_name}</Text>
                      </View>
                    )}
                    <View style={styles.historyRow}>
                      <Ionicons name="cash" size={16} color="#666" />
                      <Text style={styles.historyText}>₱{ride.passenger_count * 10}</Text>
                    </View>
                  </View>
                  {ride.status === 'completed' && ride.driver_id && (
                    reviewedRides.has(ride.id) ? (
                      <View style={styles.reviewedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                        <Text style={styles.reviewedText}>Reviewed</Text>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={styles.rateButton}
                        onPress={() => {
                          setRatingModal({ visible: true, ride });
                          setRating(5);
                          setComment('');
                        }}
                      >
                        <Ionicons name="star" size={16} color="#FFA000" />
                        <Text style={styles.rateButtonText}>Rate Driver</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={64} color="#6B2E2B" />
              </View>
              <Text style={styles.emptyText}>No Ride History</Text>
              <Text style={styles.emptySubtext}>Your completed and cancelled rides will appear here</Text>
            </View>
          )}
        </View>
      ) : showRides ? (
        <View style={styles.ridesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6B2E2B" />
              <Text style={styles.loadingText}>Loading your ride...</Text>
            </View>
          ) : activeRides.length > 0 ? (
            <ScrollView 
              style={styles.ridesList}
              contentContainerStyle={styles.ridesContent}
              showsVerticalScrollIndicator={false}
            >
              {activeRides.map(ride => (
                <RideStatusCard 
                  key={ride.id} 
                  ride={ride} 
                  onRefresh={handleRideRefresh}
                />
              ))}
              
              <View style={styles.rideInfoCard}>
                <View style={styles.infoHeader}>
                  <Ionicons name="information-circle" size={24} color="#6B2E2B" />
                  <Text style={styles.infoTitle}>Ride Information</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="cash" size={16} color="#6B2E2B" />
                  <Text style={styles.infoText}>Payment: Cash only upon arrival</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="time" size={16} color="#6B2E2B" />
                  <Text style={styles.infoText}>Average wait time: 3-8 minutes</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="person" size={16} color="#6B2E2B" />
                  <Text style={styles.infoText}>One booking at a time allowed</Text>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="car-outline" size={64} color="#6B2E2B" />
              </View>
              <Text style={styles.emptyText}>No Active Rides</Text>
              <Text style={styles.emptySubtext}>Book your first ride from the Home screen</Text>
              <TouchableOpacity 
                style={styles.bookRideButton}
                onPress={() => navigation.navigate('Home')}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.bookRideButtonText}>Book a Ride</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <LeafletMapView
            region={mapData?.config ? {
              latitude: mapData.config.center_latitude,
              longitude: mapData.config.center_longitude,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            } : DEFAULT_REGION}
            markers={terminals}
            roads={mapData?.roads || []}
            routes={mapData?.routes || []}
            showSatellite={false}
          />
        </View>
      )}

      <Modal
        visible={ratingModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingModal({ visible: false, ride: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate Your Driver</Text>
            <Text style={styles.modalSubtitle}>{ratingModal.ride?.driver_name || 'Driver'}</Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Ionicons 
                    name={star <= rating ? 'star' : 'star-outline'} 
                    size={40} 
                    color="#FFA000" 
                  />
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setRatingModal({ visible: false, ride: null })}
              >
                <Text style={styles.cancelButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitRating}
                disabled={submittingRating}
              >
                {submittingRating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 6,
    position: 'relative',
  },
  singleToggle: {
    backgroundColor: '#6B2E2B',
  },
  activeToggle: {
    backgroundColor: '#6B2E2B',
  },
  toggleText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B2E2B',
  },
  activeToggleText: {
    color: '#fff',
  },
  singleToggle: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ridesContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  ridesList: {
    flex: 1,
  },
  ridesContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B2E2B',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5E9E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  bookRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  bookRideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  rideInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F0E7E3',
    shadowColor: '#6B2E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  historyStatus: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  historyDetails: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  rateButtonText: {
    color: '#F57C00',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  reviewedText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#6B2E2B',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

// Auto-refresh active rides every 10 seconds
const useRidePolling = (fetchFunction, interval = 10000) => {
  useEffect(() => {
    const timer = setInterval(fetchFunction, interval);
    return () => clearInterval(timer);
  }, [fetchFunction, interval]);
};

export default TerminalsScreen;

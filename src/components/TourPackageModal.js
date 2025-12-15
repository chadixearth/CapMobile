// src/components/TourPackageModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  SafeAreaView,
  StatusBar,
  Dimensions,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../services/supabase';
import { tourPackageService } from '../services/tourpackage/fetchPackage';
import LeafletMapView from './LeafletMapView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_HEIGHT = 200;

const formatPeso = (val) => (typeof val === 'number' ? `₱${val.toLocaleString()}` : '—');

const TourPackageModal = ({ visible, onClose, packageData, onBook, navigation }) => {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const scrollRef = useRef(null);
  const [stats, setStats] = useState({ total: 0, average: 0 });
  const [itinerary, setItinerary] = useState([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (visible && packageData?.id) {
      loadReviews();
      loadItinerary();
    }
  }, [visible, packageData?.id]);

  const loadReviews = async () => {
    if (!packageData?.id) return;
    setLoadingReviews(true);
    try {
      const [{ data: allRatings, error: rErr }, { data: latest, error: lErr }] = await Promise.all([
        supabase.from('package_reviews').select('rating').eq('package_id', packageData.id),
        supabase
          .from('package_reviews')
          .select('id, rating, comment, created_at, users(name)')
          .eq('package_id', packageData.id)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      if (rErr) throw rErr;
      if (lErr) throw lErr;

      setReviews(latest || []);

      if (allRatings && allRatings.length) {
        const safe = allRatings
          .map((r) => Number(r.rating) || 0)
          .map((n) => Math.max(1, Math.min(5, n)));
        const avg = safe.reduce((a, b) => a + b, 0) / safe.length;
        setStats({ total: safe.length, average: avg });
      } else {
        setStats({ total: 0, average: 0 });
      }
    } catch (e) {
      if (e?.code === '42P01' || e?.message?.includes('does not exist')) {
        console.log('Reviews table not available, using fallback data');
      } else {
        console.error('loadReviews error:', e);
      }
      setReviews([]);
      setStats({ total: 0, average: 0 });
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadItinerary = async () => {
    if (!packageData?.id) return;
    setLoadingItinerary(true);
    try {
      const itineraryData = await tourPackageService.getPackageItinerary(packageData.id);
      setItinerary(itineraryData || []);
      
      if (itineraryData && itineraryData.length > 1) {
        fetchRouteFromOSRM(itineraryData);
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
      setItinerary([]);
    } finally {
      setLoadingItinerary(false);
    }
  };

  const fetchRouteFromOSRM = async (steps) => {
    try {
      const coordinates = steps.map(s => `${s.longitude},${s.latitude}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setRouteCoordinates(coords);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  const avgRating = useMemo(() => {
    const fromPkg = Number(packageData?.average_rating);
    if (fromPkg && fromPkg > 0) return fromPkg;
    return stats.average || 0;
  }, [packageData?.average_rating, stats.average]);

  const renderStars = (value, size = 14) => {
    const full = Math.floor(value);
    const hasHalf = value - full >= 0.5;
    const nodes = [];
    for (let i = 1; i <= 5; i++) {
      let icon = 'star-outline';
      if (i <= full) icon = 'star';
      else if (i === full + 1 && hasHalf) icon = 'star-half';
      nodes.push(
        <Ionicons key={i} name={icon} size={size} color="#FFD700" style={{ marginRight: 2 }} />
      );
    }
    return nodes;
  };

  const photos = React.useMemo(() => {
    if (!packageData || !Array.isArray(packageData.photos) || packageData.photos.length === 0) {
      return [require('../../assets/images/tourA.png')];
    }
    return packageData.photos.map(photo => {
      if (typeof photo === 'string') {
        return photo;
      }
      if (photo && typeof photo === 'object' && photo.url) {
        return photo.url;
      }
      return require('../../assets/images/tourA.png');
    });
  }, [packageData?.photos]);

  if (!packageData) return null;

  const onScrollPhotos = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    setActivePhoto(index);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <SafeAreaView style={styles.sheet}>
          <StatusBar barStyle="dark-content" />

          {/* Hero */}
          <View style={styles.hero}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScrollPhotos}
              scrollEventThrottle={16}
            >
              {photos.map((src, idx) => (
                <Image
                  key={idx}
                  source={typeof src === 'string' ? { uri: src } : src}
                  style={styles.heroImage}
                />
              ))}
            </ScrollView>

            {/* Adaptive gradient overlay */}
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.1)', 'transparent']}
              locations={[0, 0.4, 0.7, 1]}
              style={styles.fullOverlay}
            />

            {/* Close */}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Navigation arrows */}
            {photos.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.navArrow, styles.navArrowLeft]}
                  onPress={() => {
                    const newIndex = activePhoto > 0 ? activePhoto - 1 : photos.length - 1;
                    setActivePhoto(newIndex);
                    scrollRef.current?.scrollTo({ x: newIndex * SCREEN_WIDTH, animated: true });
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navArrow, styles.navArrowRight]}
                  onPress={() => {
                    const newIndex = activePhoto < photos.length - 1 ? activePhoto + 1 : 0;
                    setActivePhoto(newIndex);
                    scrollRef.current?.scrollTo({ x: newIndex * SCREEN_WIDTH, animated: true });
                  }}
                >
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </>
            )}

            {/* Dots */}
            {photos.length > 1 && (
              <View style={styles.dots}>
                {photos.map((_, i) => (
                  <View key={`dot-${i}`} style={[styles.dot, i === activePhoto && styles.dotActive]} />
                ))}
              </View>
            )}

            {/* Title + chips (now includes Availability) */}
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={2}>
                {packageData?.package_name || 'Tour Package'}
              </Text>
              <View style={styles.chipsRow}>
                {!!packageData?.duration_hours && (
                  <AdaptiveChip>
                    <Ionicons name="time-outline" size={14} color="#fff" />
                    <Text style={styles.chipText}>{packageData.duration_hours} hrs</Text>
                  </AdaptiveChip>
                )}
                {!!packageData?.max_pax && (
                  <AdaptiveChip>
                    <Ionicons name="people-outline" size={14} color="#fff" />
                    <Text style={styles.chipText}>Max {packageData.max_pax}</Text>
                  </AdaptiveChip>
                )}
                {/* <AdaptiveChip>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.chipText}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
                </AdaptiveChip> */}

                {/* Availability moved here */}
                <AdaptiveChip>
                  <View style={[styles.pillDot, { backgroundColor: (packageData?.is_active && packageData?.status === 'active' && (!packageData?.expiration_date || new Date(packageData.expiration_date) >= new Date())) ? '#16A34A' : '#DC2626' }]} />
                  <Text
                    style={[
                      styles.chipText,
                      { color: (packageData?.is_active && packageData?.status === 'active' && (!packageData?.expiration_date || new Date(packageData.expiration_date) >= new Date())) ? '#86EFAC' : '#FCA5A5', fontWeight: '800' },
                    ]}
                  >
                    {packageData?.expiration_date && new Date(packageData.expiration_date) < new Date() ? 'Expired' : packageData?.is_active && packageData?.status === 'active' ? 'Available' : 'Unavailable'}
                  </Text>
                </AdaptiveChip>
              </View>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Details card (now holds the description) */}
            <View style={styles.card}>
              {/* Rating summary header */}
              <View style={styles.ratingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                  {renderStars(avgRating, 16)}
                </View>
                <Text style={styles.ratingValue}>
                  {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                </Text>
              </View>
              <Text style={styles.ratingCountTop}>
                {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
              </Text>

              {/* Blurb */}
              <Text style={styles.detailBlurb}>
                {packageData?.short_description ||
                  'Join the tartanilla drivers as they explore through the key landmarks and vibrant highlights of Cebu City.'}
              </Text>

              {/* Section header */}
              <Text style={styles.detailHeader}>About this Package</Text>

              {/* Your package description moved here */}
              {!!packageData?.description && (
                <Text style={styles.aboutSubtitle}>{packageData.description}</Text>
              )}

              {/* Key-value details */}
              {packageData?.price && (
                <InfoRow
                  title="Package Price"
                  subtitle={`${formatPeso(packageData.price)} per person`}
                />
              )}
              
              {packageData?.start_time && (
                <InfoRow
                  title="Start Time"
                  subtitle={`Departure: ${packageData.start_time}`}
                />
              )}
              
              {packageData?.duration_hours && (
                <InfoRow
                  title="Duration"
                  subtitle={`${packageData.duration_hours} hours tour experience`}
                />
              )}
              
              {packageData?.max_pax && (
                <InfoRow
                  title="Group Size"
                  subtitle={`Maximum ${packageData.max_pax} passengers per booking`}
                />
              )}
              
              {packageData?.expiration_date && (
                <InfoRow
                  title="Package Validity"
                  subtitle={`Valid until: ${new Date(packageData.expiration_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}`}
                  isExpired={new Date(packageData.expiration_date) < new Date()}
                />
              )}
              
              {packageData?.available_days && Object.keys(packageData.available_days).length > 0 && (
                <InfoRow
                  title="Available Days"
                  subtitle={Array.isArray(packageData.available_days) ? packageData.available_days.join(', ') : JSON.stringify(packageData.available_days)}
                />
              )}
              
              <InfoRow title="Driver Guide" subtitle={packageData?.driver_language || 'Professional local driver'} />
              
              <InfoRow
                title="Cancellation Policy"
                subtitle={packageData?.cancellation_policy || 'Free cancellation up to 24 hours before departure'}
              />
              
              {packageData?.inclusions && (
                <InfoRow
                  title="What's Included"
                  subtitle={packageData.inclusions}
                />
              )}
              
              {packageData?.exclusions && (
                <InfoRow
                  title="What's Not Included"
                  subtitle={packageData.exclusions}
                />
              )}
              
              {packageData?.requirements && (
                <InfoRow
                  title="Requirements"
                  subtitle={packageData.requirements}
                />
              )}

              {packageData?.stops_lat && packageData?.stops_lng && packageData.stops_lat.length > 0 && (
                <InfoRow
                  title="Stops"
                  subtitle={`${packageData.stops_lat.length} stop${packageData.stops_lat.length > 1 ? 's' : ''} along the route`}
                />
              )}
            </View>

            {/* Itinerary Section */}
            {(itinerary.length > 0 || loadingItinerary) && (
              <View style={styles.card}>
                <View style={styles.itineraryHeader}>
                  <Ionicons name="map" size={20} color="#6B2E2B" />
                  <Text style={styles.sectionTitle}>Tour Itinerary</Text>
                </View>
                <Text style={styles.itinerarySubtitle}>Step-by-step journey through Cebu</Text>

                {itinerary.length > 0 && (
                  <TouchableOpacity 
                    style={styles.showMapButton}
                    onPress={() => setShowMap(!showMap)}
                  >
                    <Ionicons name={showMap ? 'map' : 'map-outline'} size={18} color="#6B2E2B" />
                    <Text style={styles.showMapButtonText}>
                      {showMap ? 'Hide Route Map' : 'Show Route Map'}
                    </Text>
                    <Ionicons name={showMap ? 'chevron-up' : 'chevron-down'} size={18} color="#6B2E2B" />
                  </TouchableOpacity>
                )}

                {showMap && itinerary.length > 0 && (
                  <View style={styles.mapContainer}>
                    <LeafletMapView
                      style={styles.itineraryMap}
                      region={{
                        latitude: itinerary[0]?.latitude || 10.295,
                        longitude: itinerary[0]?.longitude || 123.89,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      }}
                      roads={routeCoordinates.length > 0 ? [{
                        id: 'route',
                        coordinates: routeCoordinates,
                        stroke_color: '#6B2E2B',
                        stroke_width: 4,
                        stroke_opacity: 0.8
                      }] : []}
                      markers={itinerary.map((step, idx) => ({
                        latitude: step.latitude,
                        longitude: step.longitude,
                        title: `${step.step_order}. ${step.location_name}`,
                        id: step.id || idx,
                        iconColor: step.location_type === 'pickup' ? '#10B981' : 
                                   step.location_type === 'dropoff' ? '#EF4444' : '#6B2E2B',
                        label: String(step.step_order)
                      }))}
                    />
                  </View>
                )}

                {loadingItinerary ? (
                  <View style={styles.loadingItinerary}>
                    <ActivityIndicator size="small" color="#6B2E2B" />
                    <Text style={styles.loadingText}>Loading itinerary...</Text>
                  </View>
                ) : itinerary.length > 0 ? (
                  <View style={styles.itineraryList}>
                    {itinerary.map((step, index) => (
                      <View key={step.id || index} style={styles.itineraryStep}>
                        <View style={styles.stepIndicator}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>{step.step_order || index + 1}</Text>
                          </View>
                          {index < itinerary.length - 1 && <View style={styles.stepLine} />}
                        </View>
                        
                        <View style={styles.stepContent}>
                          <View style={styles.stepHeader}>
                            <Text style={styles.stepLocation}>{step.location_name}</Text>
                            {step.location_type && (
                              <View style={[
                                styles.stepTypeBadge,
                                step.location_type === 'pickup' && styles.pickupBadge,
                                step.location_type === 'dropoff' && styles.dropoffBadge
                              ]}>
                                <Text style={styles.stepTypeText}>
                                  {step.location_type === 'pickup' ? 'Start' : step.location_type === 'dropoff' ? 'End' : 'Stop'}
                                </Text>
                              </View>
                            )}
                          </View>
                          
                          {(step.image_url || (step.image_urls && step.image_urls.length > 0)) && (
                            <Image 
                              source={{ uri: step.image_url || step.image_urls[0] }}
                              style={styles.stepImage}
                              resizeMode="cover"
                            />
                          )}
                          
                          {step.description && (
                            <Text style={styles.stepDescription}>{step.description}</Text>
                          )}
                          
                          {(step.duration_hours > 0 || step.duration_minutes > 0) && (
                            <View style={styles.stepDuration}>
                              <Ionicons name="time-outline" size={16} color="#6B2E2B" />
                              <Text style={styles.stepDurationText}>
                                Duration: {step.duration_hours > 0 && `${step.duration_hours} hour${step.duration_hours > 1 ? 's' : ''} `}
                                {step.duration_minutes > 0 && `${step.duration_minutes} min${step.duration_minutes > 1 ? 's' : ''}`}
                              </Text>
                            </View>
                          )}
                          
                          {step.activities && step.activities.length > 0 && (
                            <View style={styles.stepActivities}>
                              <Text style={styles.activitiesLabel}>Things to do:</Text>
                              {step.activities.map((activity, idx) => (
                                <View key={idx} style={styles.activityItem}>
                                  <View style={styles.activityBullet} />
                                  <Text style={styles.activityText}>{activity}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            {/* Reviews */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                {loadingReviews ? <ActivityIndicator size="small" /> : null}
              </View>

              {stats.total > 0 ? (
                <>
                  <View style={styles.ratingCompact}>
                    <Text style={styles.ratingNum}>{avgRating.toFixed(1)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {renderStars(avgRating, 16)}
                      <Text style={styles.ratingCount}> {stats.total}</Text>
                    </View>
                  </View>

                  <FlatList
                    data={reviews}
                    keyExtractor={(it) => String(it.id)}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.sep} />}
                    renderItem={({ item }) => (
                      <View style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewer}>
                            <View style={styles.av}>
                              <Text style={styles.avTxt}>
                                {(item?.users?.name || 'A').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.revName}>{item?.users?.name || 'Anonymous'}</Text>
                              <View style={{ flexDirection: 'row' }}>
                                {renderStars(Number(item.rating) || 0)}
                              </View>
                            </View>
                          </View>
                          <Text style={styles.revDate}>
                            {item?.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                          </Text>
                        </View>
                        {!!item?.comment && <Text style={styles.revText}>{item.comment}</Text>}
                      </View>
                    )}
                  />
                </>
              ) : (
                <Text style={styles.noReviews}>No reviews yet. Be the first!</Text>
              )}
            </View>

            <View style={{ height: 96 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerPrice}>{formatPeso(packageData?.price)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.cta, (!packageData?.is_active || packageData?.status !== 'active' || (packageData?.expiration_date && new Date(packageData.expiration_date) < new Date())) && styles.ctaDisabled]}
              onPress={() => {
                if (packageData?.expiration_date && new Date(packageData.expiration_date) < new Date()) {
                  Alert.alert(
                    'Package Expired',
                    'This tour package has expired and is no longer available for booking.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                if (!packageData?.is_active || packageData?.status !== 'active') {
                  Alert.alert(
                    'Package Unavailable',
                    'This tour package is currently unavailable for booking.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                onClose?.();
                onBook?.();
              }}
              disabled={!packageData?.is_active || packageData?.status !== 'active' || (packageData?.expiration_date && new Date(packageData.expiration_date) < new Date())}
              accessibilityRole="button"
              accessibilityLabel={(packageData?.expiration_date && new Date(packageData.expiration_date) < new Date()) ? 'Expired' : (packageData?.is_active && packageData?.status === 'active') ? 'Book now' : 'Unavailable'}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.ctaText}>
                {(packageData?.expiration_date && new Date(packageData.expiration_date) < new Date()) ? 'Expired' : (packageData?.is_active && packageData?.status === 'active') ? 'Book Now' : 'Unavailable'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

/** Simple label–value row used in the Details card */
const InfoRow = ({ title, subtitle, isExpired = false }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoTitle}>{title}</Text>
    <Text style={[styles.infoSubtitle, isExpired && styles.expiredText]}>{subtitle}</Text>
  </View>
);

/** Info row with map button for locations */
const InfoRowWithMap = ({ title, subtitle, onMapPress }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowHeader}>
      <Text style={styles.infoTitle}>{title}</Text>
      <TouchableOpacity style={styles.mapButton} onPress={onMapPress}>
        <Ionicons name="map-outline" size={16} color="#6B2E2B" />
        <Text style={styles.mapButtonText}>View on Map</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.infoSubtitle}>{subtitle}</Text>
  </View>
);

/** Adaptive chip that stays readable on any hero image */
const AdaptiveChip = ({ children }) => {
  return (
    <View style={styles.chip}>
      <View style={styles.chipOverlay} />
      <View style={styles.chipInner}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Backdrop + sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '96%',
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Hero
  hero: {
    width: '100%',
    height: IMG_HEIGHT,
    position: 'relative',
    backgroundColor: '#EAEAEA',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: IMG_HEIGHT,
    resizeMode: 'cover',
  },
  fullOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  navArrowLeft: {
    left: 16,
  },
  navArrowRight: {
    right: 16,
  },
  dots: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    zIndex: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 14,
    borderRadius: 7,
  },
  titleWrap: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    zIndex: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },

  // Chips (adaptive)
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  chipOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
    zIndex: 1,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 2,
  },
  chipText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowRadius: 4,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  price: {
    fontSize: 22,
    fontWeight: '900',
    color: '#6B2E2B',
  },

  // --- Details card styles ---
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 6,
  },
  ratingCountTop: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  detailBlurb: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
  },
  detailHeader: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F5E9E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0CFC2',
  },
  // Route Card
  routeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  routeHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  routeContent: {
    marginBottom: 12,
  },
  locationBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconWrapper: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#D1FAE5',
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#FEE2E2',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#D1D5DB',
    marginLeft: 15,
    marginVertical: 4,
  },
  locationInfo: {
    flex: 1,
    paddingLeft: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationName: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 20,
  },
  mapActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#6B2E2B',
    gap: 8,
  },
  mapActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B2E2B',
    flex: 1,
    textAlign: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 13.5,
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Itinerary Styles
  itineraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itinerarySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  loadingItinerary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  itineraryList: {
    marginTop: 8,
  },
  itineraryStep: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 16,
    width: 32,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B2E2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    minHeight: 20,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 4,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepLocation: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  stepTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  pickupBadge: {
    backgroundColor: '#D1FAE5',
  },
  dropoffBadge: {
    backgroundColor: '#FEE2E2',
  },
  stepTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  stepImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  stepDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  stepDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  stepDurationText: {
    fontSize: 13,
    color: '#6B2E2B',
    fontWeight: '700',
    marginLeft: 6,
  },
  stepActivities: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  activitiesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  activityBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6B2E2B',
    marginTop: 7,
    marginRight: 8,
  },
  activityText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  mapContainer: {
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itineraryMap: {
    height: 250,
    width: '100%',
  },
  showMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5E9E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#6B2E2B',
    gap: 8,
    marginBottom: 12,
  },
  showMapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B2E2B',
  },
  expiredText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  aboutSubtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },

  // Reviews
  ratingCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ratingNum: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  ratingCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  sep: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  reviewItem: {
    paddingVertical: 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  av: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B2E2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  revName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  revDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  revText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  noReviews: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 6,
  },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  footerPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  cta: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: '#C7C7C7',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default TourPackageModal;

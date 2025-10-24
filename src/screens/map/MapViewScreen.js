import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity, RefreshControl, Modal, FlatList } from 'react-native';
import LeafletMapView from '../../components/LeafletMapView'; // WebView-based Leaflet map
import BackButton from '../../components/BackButton';
import PointImageModal from '../../components/PointImageModal';
import { fetchMapData, fetchRoutes, getMapCacheInfo, clearMapCache } from '../../services/map/fetchMap';
import { getRoutesByPickup } from '../../services/rideHailingService';
import { apiRequest } from '../../services/authService';
import { fetchRouteSummaries as fetchRouteSummariesService, processMapPointsWithColors, processRoadHighlightsWithColors, buildRouteSummariesFromPickups } from '../../services/routeManagementService';

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const MapViewScreen = ({ navigation, route }) => {
  const { mode, onLocationSelect, location, locations } = route?.params || {};
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [markers, setMarkers] = useState([]);
  const [roads, setRoads] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [zones, setZones] = useState([]);
  const [showLegend, setShowLegend] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [showSatellite, setShowSatellite] = useState(false);
  const [mapLoadTimeout, setMapLoadTimeout] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [showingRoutes, setShowingRoutes] = useState(false);
  const [routeSummaries, setRouteSummaries] = useState([]);
  const [allMarkers, setAllMarkers] = useState([]);
  const [allRoads, setAllRoads] = useState([]);
  const hasLoadedCache = useRef(false);
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    // Set a timeout for initial loading
    loadTimeoutRef.current = setTimeout(() => {
      if (initialLoading) {
        setMapLoadTimeout(true);
        setInitialLoading(false);
        setLoading(false);
        // Use empty data with default region
        setMapData({
          points: [],
          roads: [],
          routes: [],
          zones: [],
          config: {
            center_latitude: 10.3157,
            center_longitude: 123.8854,
            zoom_level: 13
          },
          total_items: {}
        });
      }
    }, 8000); // 8 second timeout
    
    loadMapDataWithCache();
    
    // Set up background update listener
    global.mapUpdateCallback = (newData) => {
      processMapData(newData);
      showUpdateNotification();
    };
    
    return () => {
      // Cleanup
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      global.mapUpdateCallback = null;
    };
  }, []);
  

  
  // Debug effect to log road state changes
  useEffect(() => {
    console.log('Roads state changed:', {
      roadsCount: roads.length,
      allRoadsCount: allRoads.length,
      mode: mode,
      hasMapData: !!mapData,
      roadColors: roads.map(r => r.color || r.stroke_color).slice(0, 5)
    });
    
    if (roads.length > 0) {
      console.log('First road sample:', roads[0]);
    }
  }, [roads, allRoads, mode, mapData]);
  
  const fetchRouteSummaries = async () => {
    const summaries = await fetchRouteSummariesService();
    console.log('Route summaries from service:', summaries?.length || 0);
    setRouteSummaries(summaries || []);
    return summaries || [];
  };

  const loadMapDataWithCache = async () => {
    try {
      setInitialLoading(true);
      setMapLoadTimeout(false);
      
      // Get cache info
      const info = await getMapCacheInfo();
      setCacheInfo(info);
      
      // Load cached data first (instant)
      const data = await fetchMapData({ cacheOnly: !hasLoadedCache.current });
      console.log('Fetched map data:', {
        hasData: !!data,
        pointsCount: data?.points?.length || 0,
        roadsCount: data?.roads?.length || 0
      });
      
      // Fetch route summaries to get proper colors
      const routeSummaries = await fetchRouteSummaries();
      console.log('Fetched route summaries:', routeSummaries.length);
      
      if (data) {
        console.log('Raw map data received:', {
          points: data.points?.length || 0,
          roads: data.roads?.length || 0,
          routes: data.routes?.length || 0,
          zones: data.zones?.length || 0,
          samplePoint: data.points?.[0],
          sampleRoad: data.roads?.[0]
        });
        
        processMapData(data, routeSummaries);
        hasLoadedCache.current = true;
      } else {
        console.warn('No map data received');
      }
      
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      setInitialLoading(false);
      setLoading(false);
    } catch (err) {
      
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      processMapData({
        points: [],
        roads: [],
        routes: [],
        zones: [],
        config: {
          center_latitude: 10.3157,
          center_longitude: 123.8854,
          zoom_level: 13
        },
        total_items: {},
        error: true,
        errorMessage: err.message
      }, []);
      
      setInitialLoading(false);
      setLoading(false);
      setError(err.message);
    }
  };
  
  const processMapData = (data, routeSummaries = []) => {
    console.log('processMapData called with:', {
      hasData: !!data,
      pointsCount: data?.points?.length || 0,
      roadsCount: data?.roads?.length || 0,
      routeSummariesCount: routeSummaries.length
    });
    
    if (!data) return;
    
    setMapData(data);
    
    // Process points with route color associations - show ALL points immediately
    if (data.points && data.points.length > 0) {
      console.log('Processing', data.points.length, 'points with', routeSummaries.length, 'route summaries');
      let processedMarkers = processMapPointsWithColors(data.points, routeSummaries);
      console.log('Processed markers:', processedMarkers.length, 'markers');
      console.log('Sample processed marker:', processedMarkers[0]);
      
      // Filter markers based on selection mode
      if (mode === 'selectPickup') {
        processedMarkers = processedMarkers.filter(marker => marker.pointType === 'pickup');
      }
      
      setAllMarkers(processedMarkers);
      
      if (mode === 'viewRoute' && locations) {
        // Show both pickup and destination markers
        const routeMarkers = [
          {
            latitude: parseFloat(locations.pickup.latitude),
            longitude: parseFloat(locations.pickup.longitude),
            title: locations.pickup.name || 'Pickup Location',
            description: 'Tour package pickup point',
            pointType: 'pickup',
            iconColor: '#2E7D32',
            id: 'pickup-location'
          },
          {
            latitude: parseFloat(locations.destination.latitude),
            longitude: parseFloat(locations.destination.longitude),
            title: locations.destination.name || 'Destination',
            description: 'Tour package destination',
            pointType: 'destination',
            iconColor: '#C62828',
            id: 'destination-location'
          }
        ];
        setMarkers(routeMarkers);
        
        const routeData = {
          id: 'tour-route',
          name: 'Tour Route',
          start_latitude: parseFloat(locations.pickup.latitude),
          start_longitude: parseFloat(locations.pickup.longitude),
          end_latitude: parseFloat(locations.destination.latitude),
          end_longitude: parseFloat(locations.destination.longitude),
          stroke_color: '#007AFF',
          stroke_width: 6,
          stroke_opacity: 0.8,
          highlight_type: 'tour_route'
        };
        setRoads([routeData]);
      } else if (mode === 'viewLocation' && location) {
        // Show only the specific location marker
        const locationMarker = {
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
          title: location.name || 'Pickup Location',
          description: 'Tour package pickup point',
          pointType: 'pickup',
          iconColor: '#6B2E2B',
          id: 'pickup-location'
        };
        setMarkers([locationMarker]);
        setRoads([]);
      } else {
        // Show ALL markers immediately (pickup and dropoff)
        console.log('Setting markers for display:', processedMarkers.length, 'markers');
        setMarkers(processedMarkers);
      }
    } else {
      console.log('No points data to process');
      setMarkers([]);
    }
    
    // Process and show ALL roads immediately with proper colors
    if (data.roads && data.roads.length > 0) {
      const processedRoads = processRoadHighlightsWithColors(data.roads, routeSummaries);
      
      console.log('Setting ALL roads immediately:', processedRoads.length, 'roads');
      console.log('Road colors:', processedRoads.map(r => ({ id: r.id, color: r.stroke_color })));
      
      setAllRoads(processedRoads);
      
      // Always show ALL roads immediately unless in specific view modes
      if (mode === 'viewLocation' && location) {
        setRoads([]);
      } else {
        setRoads(processedRoads);
      }
    } else {
      setAllRoads([]);
      setRoads([]);
    }
    
    // Process routes and zones
    if (data.routes) setRoutes(data.routes);
    if (data.zones) setZones(data.zones);
    
    // Update region
    if (mode === 'viewRoute' && locations) {
      // Calculate bounds for both pickup and destination
      const pickup = locations.pickup;
      const destination = locations.destination;
      const minLat = Math.min(pickup.latitude, destination.latitude);
      const maxLat = Math.max(pickup.latitude, destination.latitude);
      const minLng = Math.min(pickup.longitude, destination.longitude);
      const maxLng = Math.max(pickup.longitude, destination.longitude);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const deltaLat = Math.max((maxLat - minLat) * 2.0, 0.05);
      const deltaLng = Math.max((maxLng - minLng) * 2.0, 0.05);
      
      const newRegion = {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: deltaLat,
        longitudeDelta: deltaLng,
      };
      setRegion(newRegion);
    } else if (mode === 'viewLocation' && location) {
      const newRegion = {
        latitude: parseFloat(location.latitude || 10.3157),
        longitude: parseFloat(location.longitude || 123.8854),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
    } else {
      // Calculate bounds to fit all markers and roads
      let allPoints = [];
      
      // Add all marker coordinates
      if (data.points && data.points.length > 0) {
        allPoints = allPoints.concat(data.points.map(p => ({
          lat: parseFloat(p.latitude || 0),
          lng: parseFloat(p.longitude || 0)
        })));
      }
      
      // Add road coordinates
      if (data.roads && data.roads.length > 0) {
        data.roads.forEach(road => {
          if (road.road_coordinates && Array.isArray(road.road_coordinates)) {
            road.road_coordinates.forEach(coord => {
              if (coord && coord.length >= 2) {
                allPoints.push({ lat: coord[0], lng: coord[1] });
              }
            });
          }
          if (road.start_latitude && road.start_longitude) {
            allPoints.push({ lat: parseFloat(road.start_latitude), lng: parseFloat(road.start_longitude) });
          }
          if (road.end_latitude && road.end_longitude) {
            allPoints.push({ lat: parseFloat(road.end_latitude), lng: parseFloat(road.end_longitude) });
          }
        });
      }
      
      if (allPoints.length > 0) {
        // Calculate bounds
        const lats = allPoints.map(p => p.lat).filter(lat => lat && !isNaN(lat));
        const lngs = allPoints.map(p => p.lng).filter(lng => lng && !isNaN(lng));
        
        if (lats.length > 0 && lngs.length > 0) {
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          
          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;
          const deltaLat = Math.max((maxLat - minLat) * 1.2, 0.01);
          const deltaLng = Math.max((maxLng - minLng) * 1.2, 0.01);
          
          const newRegion = {
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: deltaLat,
            longitudeDelta: deltaLng,
          };
          setRegion(newRegion);
        } else {
          // Fallback to default region
          setRegion({
            latitude: parseFloat(data.config?.center_latitude || 10.3157),
            longitude: parseFloat(data.config?.center_longitude || 123.8854),
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          });
        }
      } else {
        // Fallback to default region
        setRegion({
          latitude: parseFloat(data.config?.center_latitude || 10.3157),
          longitude: parseFloat(data.config?.center_longitude || 123.8854),
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        });
      }
    }
  };
  
  const showUpdateNotification = () => {
    // Subtle notification that map was updated
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Force refresh from server
      const data = await fetchMapData({ forceRefresh: true });
      
      // Fetch route summaries to get proper colors
      const routeSummaries = await fetchRouteSummaries();
      
      if (data) {
        processMapData(data, routeSummaries);
        
        // Update cache info
        const info = await getMapCacheInfo();
        setCacheInfo(info);
      }
    } catch (err) {
      Alert.alert(
        'Error',
        'Failed to refresh map data',
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, []);
  
  const handleMarkerPress = async (marker) => {
    if (mode === 'selectPickup' && onLocationSelect) {
      Alert.alert(
        'Confirm Selection',
        `Select ${marker.title} as pickup location?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Select',
            onPress: () => {
              onLocationSelect({
                id: marker.id,
                name: marker.title,
                latitude: marker.latitude,
                longitude: marker.longitude,
                pointType: marker.pointType
              });
              navigation.goBack();
            }
          }
        ]
      );
    } else if (marker.pointType === 'pickup') {
      // Show pickup point with associated drop-off points
      try {
        setLoading(true);
        const routeResult = await getRoutesByPickup(marker.id);
        
        if (routeResult.success && routeResult.data) {
          const { available_destinations = [], road_highlights = [], color } = routeResult.data;
          
          // Show pickup marker
          const pickupMarker = {
            ...marker,
            iconColor: color || marker.iconColor
          };
          
          // Create dropoff markers
          const dropoffMarkers = available_destinations.map(dest => ({
            latitude: parseFloat(dest.latitude),
            longitude: parseFloat(dest.longitude),
            title: dest.name,
            description: 'Drop-off point',
            pointType: 'dropoff',
            iconColor: color || '#FF5722',
            id: dest.id
          }));
          
          // Show all markers (pickup + dropoffs)
          setMarkers([pickupMarker, ...dropoffMarkers]);
          
          // Show road highlights
          if (road_highlights.length > 0) {
            const processedRoads = road_highlights.map(road => {
              // Handle different coordinate formats
              let coordinates = road.coordinates || road.road_coordinates;
              
              // If coordinates is a string, try to parse it
              if (typeof coordinates === 'string') {
                try {
                  coordinates = JSON.parse(coordinates);
                } catch (e) {
                  console.warn('Failed to parse road coordinates:', e);
                  coordinates = null;
                }
              }
              
              return {
                id: road.id,
                name: road.name || 'Route',
                road_coordinates: coordinates,
                start_latitude: road.start_latitude,
                start_longitude: road.start_longitude,
                end_latitude: road.end_latitude,
                end_longitude: road.end_longitude,
                stroke_color: color || road.color || road.stroke_color || '#007AFF',
                stroke_width: road.weight || road.stroke_width || 4,
                stroke_opacity: road.opacity || road.stroke_opacity || 0.7,
                highlight_type: road.highlight_type || 'route'
              };
            });
            setRoads(processedRoads);
          }
          // Keep original roads visible if no specific highlights found
          
          Alert.alert(
            marker.title,
            `Found ${available_destinations.length} available destinations${road_highlights.length > 0 ? '. Specific routes are highlighted.' : '.'}`,
            [
              { text: 'Navigate', onPress: () => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${marker.latitude},${marker.longitude}`;
                require('react-native').Linking.openURL(url);
              }},
              { text: 'Show All', onPress: () => {
                setMarkers(allMarkers);
                setRoads(allRoads);
              }},
              { text: 'OK' }
            ]
          );
        } else {
          Alert.alert(
            marker.title,
            'No specific routes available from this pickup point.',
            [
              { text: 'Navigate', onPress: () => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${marker.latitude},${marker.longitude}`;
                require('react-native').Linking.openURL(url);
              }},
              { text: 'OK' }
            ]
          );
        }
      } catch (error) {
        Alert.alert(
          'Error',
          'Failed to load routes. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setLoading(false);
      }
    } else if (marker.image_urls && marker.image_urls.length > 0) {
      // Show images if available
      setSelectedPoint(marker);
      setShowImageModal(true);
    } else {
      // Show basic info alert
      Alert.alert(
        marker.title,
        marker.description || 'No additional information available',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMapPress = (location) => {
    if (mode === 'selectDrop' && onLocationSelect) {
      Alert.alert(
        'Confirm Selection',
        `Select this location as drop point?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Select',
            onPress: () => {
              onLocationSelect({
                name: 'Custom Drop Location',
                latitude: location.latitude,
                longitude: location.longitude,
                pointType: 'dropoff'
              });
              navigation.goBack();
            }
          }
        ]
      );
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached map data. The map will need to download fresh data on next load.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearMapCache();
              setCacheInfo(null);
              Alert.alert('Success', 'Cache cleared successfully');
              // Reload with fresh data
              loadMapDataWithCache();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  const renderContent = () => {
    if (initialLoading && !mapLoadTimeout) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
          <Text style={styles.loadingSubText}>Preparing your map experience</Text>
        </View>
      );
    }

    if (error && !mapData) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load map data</Text>
          <Text style={styles.errorSubText}>{error}</Text>
        </View>
      );
    }

    return (
      <View style={styles.mapWrapper}>
        {/* Full screen Leaflet map in WebView */}
        <View style={styles.fullMapContainer}>
          <LeafletMapView 
            region={region} 
            markers={markers}
            roads={roads}
            routes={routes}
            showSatellite={showSatellite}
            onMarkerPress={handleMarkerPress}
            onMapPress={mode === 'selectDrop' ? handleMapPress : undefined}
          />
        </View>
        
        {/* Mode Headers */}
        {mode && (
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>
              {mode === 'selectPickup' ? 'Select Pickup Terminal' : 
               mode === 'selectDrop' ? 'Select Drop Location' :
               mode === 'viewRoute' ? 'Tour Route' :
               mode === 'viewLocation' ? 'Pickup Location' : 'Map View'}
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancelButton}>
                {mode === 'viewLocation' || mode === 'viewRoute' ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Floating Map Controls */}
        <View style={styles.floatingControls}>

          
          {/* Reset View Button */}
          <TouchableOpacity 
            style={[styles.floatingButton, styles.resetViewButton]}
            onPress={() => {
              setMarkers(allMarkers);
              setRoads(allRoads);
            }}
          >
            <Text style={styles.floatingButtonText}>🔄</Text>
          </TouchableOpacity>
          
          {/* Refresh Button */}
          <TouchableOpacity 
            style={[styles.floatingButton, styles.refreshButton]}
            onPress={onRefresh}
          >
            <Text style={styles.floatingButtonText}>🔄</Text>
          </TouchableOpacity>
          
          {/* Force Refresh Button */}
          <TouchableOpacity 
            style={[styles.floatingButton, styles.forceRefreshButton]}
            onPress={() => {
              Alert.alert(
                'Force Refresh',
                'Clear cache and reload fresh data?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Refresh',
                    onPress: async () => {
                      await clearMapCache();
                      loadMapDataWithCache();
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.floatingButtonText}>💾</Text>
          </TouchableOpacity>
          
          {/* Satellite Toggle */}
          <TouchableOpacity 
            style={[styles.floatingButton, showSatellite && styles.floatingButtonActive]}
            onPress={() => setShowSatellite(!showSatellite)}
          >
            <Text style={styles.floatingButtonText}>{showSatellite ? '🗺️' : '🛰️'}</Text>
          </TouchableOpacity>
          
          {/* Legend Toggle */}
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={() => setShowLegend(!showLegend)}
          >
            <Text style={styles.floatingButtonText}>ℹ️</Text>
          </TouchableOpacity>
        </View>
        
        {/* Legend Overlay */}
        {showLegend && (
          <View style={styles.legendOverlay}>
            <View style={styles.legendCard}>
              <View style={styles.legendHeader}>
                <Text style={styles.legendTitle}>Map Legend</Text>
                <TouchableOpacity onPress={() => setShowLegend(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.legendContent}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIcon, { backgroundColor: '#FF0000' }]} />
                  <Text style={styles.legendText}>Pickup Points</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIcon, { backgroundColor: '#00AA00' }]} />
                  <Text style={styles.legendText}>Stations</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIcon, { backgroundColor: '#0066CC' }]} />
                  <Text style={styles.legendText}>Landmarks</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine]} />
                  <Text style={styles.legendText}>Routes</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        
        {/* Bottom Info Card */}
        {mapData && (
          <View style={styles.bottomCard}>
            <View style={styles.dragHandle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{mapData.total_items?.points || 0}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{mapData.total_items?.roads || 0}</Text>
                  <Text style={styles.statLabel}>Roads</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{mapData.total_items?.routes || 0}</Text>
                  <Text style={styles.statLabel}>Routes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{mapData.total_items?.zones || 0}</Text>
                  <Text style={styles.statLabel}>Zones</Text>
                </View>
                {cacheInfo && !cacheInfo.isExpired && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: '#4CAF50', fontSize: 20 }]}>✓</Text>
                      <Text style={styles.statLabel}>Cached</Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
            
            {/* Settings button */}
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={handleClearCache}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Map View</Text>
          {mapData?.lastUpdated && (
            <Text style={styles.headerSubtitle}>
              {cacheInfo?.isExpired ? 'Updating...' : 'Up to date'}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>
      
      {/* Map Content */}
      {renderContent()}
      
      {/* Point Image Modal */}
      <PointImageModal
        visible={showImageModal}
        onClose={() => setShowImageModal(false)}
        point={selectedPoint}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#F5E9E2',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  
  // Map styles
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  fullMapContainer: {
    flex: 1,
  },
  
  // Floating controls
  floatingControls: {
    position: 'absolute',
    top: 20,
    right: 16,
    gap: 8,
  },
  floatingButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 6,
    shadowColor: '#6B2E2B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#F0E7E3',
  },
  floatingButtonActive: {
    backgroundColor: '#6B2E2B',
  },
  floatingButtonText: {
    fontSize: 22,
  },
  refreshButton: {
    backgroundColor: '#4CAF50',
  },
  resetViewButton: {
    backgroundColor: '#81C784',
  },
  forceRefreshButton: {
    backgroundColor: '#FFB74D',
  },
  
  // Legend overlay
  legendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  legendCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 320,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  legendContent: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  legendIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  legendLine: {
    width: 16,
    height: 4,
    backgroundColor: '#007AFF',
    marginRight: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 14,
    color: '#555',
  },
  
  // Bottom card
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    elevation: 12,
    shadowColor: '#6B2E2B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0E7E3',
  },
  dragHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#6B2E2B',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6B2E2B',
  },
  statLabel: {
    fontSize: 11,
    color: '#8D6E63',
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#F0E7E3',
  },
  settingsButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: 4,
  },
  settingsIcon: {
    fontSize: 20,
  },
  
  // Selection mode styles
  selectionHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Loading and error states
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#6B2E2B',
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8D6E63',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default MapViewScreen;

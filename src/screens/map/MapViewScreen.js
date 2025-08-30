import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity, RefreshControl, Modal, FlatList } from 'react-native';
import LeafletMapView from '../../components/LeafletMapView'; // Using Leaflet for consistency with web
import BackButton from '../../components/BackButton';
import { fetchMapData, fetchRoutes, getMapCacheInfo, clearMapCache } from '../../services/map/fetchMap';

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const MapViewScreen = ({ navigation }) => {
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
  const hasLoadedCache = useRef(false);
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    console.log('MapViewScreen mounted, loading map data with cache...');
    
    // Set a timeout for initial loading
    loadTimeoutRef.current = setTimeout(() => {
      if (initialLoading) {
        console.log('Map loading timeout reached, showing fallback');
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
    }, 10000); // 10 second timeout
    
    loadMapDataWithCache();
    
    // Set up background update listener
    global.mapUpdateCallback = (newData) => {
      console.log('Map data updated in background');
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
  
  const loadMapDataWithCache = async () => {
    try {
      // First, load from cache immediately for instant display
      setInitialLoading(true);
      setMapLoadTimeout(false);
      
      // Get cache info
      const info = await getMapCacheInfo();
      setCacheInfo(info);
      
      // Load cached data first (instant)
      const data = await fetchMapData({ cacheOnly: !hasLoadedCache.current });
      
      if (data) {
        console.log('Displaying map data:', {
          points: data.points?.length || 0,
          roads: data.roads?.length || 0,
          routes: data.routes?.length || 0
        });
        processMapData(data);
        hasLoadedCache.current = true;
      } else {
        console.log('No data received, using defaults');
        // Set default empty data
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
          total_items: {}
        });
      }
      
      // Clear timeout if load successful
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      setInitialLoading(false);
      setLoading(false);
    } catch (err) {
      console.error('Error in initial load:', err);
      
      // Clear timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      // Use default data on error
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
      });
      
      setInitialLoading(false);
      setLoading(false);
      setError(err.message);
    }
  };
  
  const processMapData = (data) => {
    if (!data) return;
    
    setMapData(data);
    
    // Process points
    if (data.points && data.points.length > 0) {
      const processedMarkers = data.points.map(point => ({
        latitude: parseFloat(point.latitude || 0),
        longitude: parseFloat(point.longitude || 0),
        title: point.name || 'Unknown Point',
        description: point.description || '',
        pointType: point.point_type || point.pointType || 'unknown',
        iconColor: point.icon_color || point.iconColor || '#FF0000',
        id: point.id || Math.random().toString(),
        isActive: point.is_active !== false
      }));
      setMarkers(processedMarkers);
    }
    
    // Process roads - handle database format
    if (data.roads && data.roads.length > 0) {
      const processedRoads = data.roads.map(road => ({
        id: road.id || Math.random().toString(),
        name: road.name || 'Road Highlight',
        road_coordinates: road.road_coordinates || road.coordinates || null,
        start_latitude: road.start_latitude,
        start_longitude: road.start_longitude,
        end_latitude: road.end_latitude,
        end_longitude: road.end_longitude,
        stroke_color: road.stroke_color || road.color || '#007AFF',
        stroke_width: road.stroke_width || road.weight || 4,
        stroke_opacity: road.stroke_opacity || road.opacity || 0.7,
        highlight_type: road.highlight_type || road.type || 'available'
      }));
      setRoads(processedRoads);
    }
    
    // Process routes and zones
    if (data.routes) setRoutes(data.routes);
    if (data.zones) setZones(data.zones);
    
    // Update region
    if (data.config) {
      const newRegion = {
        latitude: parseFloat(data.config.center_latitude || 10.3157),
        longitude: parseFloat(data.config.center_longitude || 123.8854),
        latitudeDelta: data.config.zoom_level ? (0.5 / parseFloat(data.config.zoom_level)) : 0.15,
        longitudeDelta: data.config.zoom_level ? (0.5 / parseFloat(data.config.zoom_level)) : 0.15,
      };
      setRegion(newRegion);
    }
  };
  
  const showUpdateNotification = () => {
    // You could show a subtle notification that map was updated
    console.log('Map data refreshed in background');
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      console.log('Manual refresh triggered');
      
      // Force refresh from server
      const data = await fetchMapData({ forceRefresh: true });
      
      if (data) {
        processMapData(data);
        
        // Update cache info
        const info = await getMapCacheInfo();
        setCacheInfo(info);
        
        Alert.alert(
          'Success',
          'Map data refreshed successfully',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Error refreshing map:', err);
      Alert.alert(
        'Error',
        'Failed to refresh map data',
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, []);
  
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
        {/* Full screen map */}
        <View style={styles.fullMapContainer}>
          <LeafletMapView 
            region={region} 
            markers={markers}
            roads={roads}
            routes={routes}
            showSatellite={showSatellite}
          />
        </View>
        
        {/* Floating Map Controls */}
        <View style={styles.floatingControls}>
          {/* Refresh Button */}
          <TouchableOpacity 
            style={[styles.floatingButton, styles.refreshButton]}
            onPress={onRefresh}
          >
            <Text style={styles.floatingButtonText}>🔄</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
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
    top: 16,
    right: 16,
    gap: 12,
  },
  floatingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  floatingButtonActive: {
    backgroundColor: '#007AFF',
  },
  floatingButtonText: {
    fontSize: 22,
  },
  refreshButton: {
    backgroundColor: '#4CAF50',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
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
  
  // Loading and error states
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  loadingSubText: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
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

import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import LeafletMap from '../../components/LeafletMap';
import BackButton from '../../components/BackButton';
import { fetchMapData } from '../../services/map/fetchMap';

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const MapViewScreen = ({ navigation }) => {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [markers, setMarkers] = useState([]);
  const [roads, setRoads] = useState([]);

  useEffect(() => {
    // For testing, let's first try without API call
    console.log('MapViewScreen mounted, testing with default data first...');
    
    // Set some test data immediately
    setMarkers([{
      latitude: 10.3157,
      longitude: 123.8854,
      title: 'Test Marker',
      description: 'This is a test marker',
      pointType: 'pickup',
      iconColor: '#FF0000',
      id: 'test-1'
    }]);
    setLoading(false);
    
    // Then try to load real data after a short delay
    setTimeout(() => {
      loadMapData();
    }, 2000);
  }, []);

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting to fetch map data...');
      const data = await fetchMapData();
      console.log('Received map data:', data);
      setMapData(data);
      
      // Process points into markers format
      if (data.points && data.points.length > 0) {
        console.log('Processing', data.points.length, 'points');
        const processedMarkers = data.points.map(point => ({
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          title: point.name || 'Unknown Point',
          description: point.description || '',
          pointType: point.point_type || 'unknown',
          iconColor: point.icon_color || '#FF0000',
          id: point.id
        }));
        setMarkers(processedMarkers);
        console.log('Processed markers:', processedMarkers);
      } else {
        console.log('No points found in data');
        // Add some default markers for testing
        setMarkers([{
          latitude: 10.3157,
          longitude: 123.8854,
          title: 'Default Point',
          description: 'Test marker',
          pointType: 'pickup',
          iconColor: '#FF0000',
          id: 'default-1'
        }]);
      }

      // Process roads into road highlights format
      if (data.roads && data.roads.length > 0) {
        console.log('Processing', data.roads.length, 'roads');
        const processedRoads = data.roads.map(road => ({
          id: road.id,
          name: road.name || 'Road Highlight',
          coordinates: road.coordinates,
          start_latitude: road.start_latitude,
          start_longitude: road.start_longitude,
          end_latitude: road.end_latitude,
          end_longitude: road.end_longitude,
          color: road.color || '#007AFF',
          weight: road.weight || 4,
          opacity: road.opacity || 0.7
        }));
        setRoads(processedRoads);
        console.log('Processed roads:', processedRoads);
      } else {
        console.log('No roads found in data');
      }

      // If we have a config with center coordinates, update region
      if (data.config && data.config.center_latitude && data.config.center_longitude) {
        console.log('Using config center coordinates');
        setRegion({
          latitude: parseFloat(data.config.center_latitude),
          longitude: parseFloat(data.config.center_longitude),
          latitudeDelta: parseFloat(data.config.zoom_level || 0.15),
          longitudeDelta: parseFloat(data.config.zoom_level || 0.15),
        });
      } else {
        console.log('Using default region');
      }
      
    } catch (err) {
      console.error('Error loading map data:', err);
      setError(err.message || 'Failed to load map data');
      
      // Set default data so map still shows
      setMarkers([{
        latitude: 10.3157,
        longitude: 123.8854,
        title: 'Default Point',
        description: 'API Error - Test marker',
        pointType: 'pickup',
        iconColor: '#FF0000',
        id: 'error-default'
      }]);
      
      Alert.alert(
        'Error',
        'Failed to load map data. Showing default view with test marker.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map data...</Text>
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
      <View style={styles.mapContainer}>
        <LeafletMap region={region} markers={markers} roads={roads} />
        {mapData && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Points: {mapData.points?.length || 0} | Roads: {mapData.roads?.length || 0}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.header}>Map View</Text>
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
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
  infoContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 10,
  },
  infoText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default MapViewScreen;

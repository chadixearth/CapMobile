import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { getRoutesByPickup } from '../services/rideHailingService';
import { getAllRoadHighlightsWithPoints, processRoadHighlightsForMap } from '../services/roadHighlightsService';

const RoadHighlightDebugger = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const testRoadHighlights = async () => {
    setLoading(true);
    try {
      console.log('🔍 Starting road highlights debug test...');
      
      // Test 1: Get all road highlights with points
      const allData = await getAllRoadHighlightsWithPoints();
      console.log('🔍 All road highlights result:', allData);
      
      // Test 2: Test specific pickup point if available
      let specificPickupTest = null;
      if (allData.success && allData.pickupPoints.length > 0) {
        const firstPickup = allData.pickupPoints[0];
        console.log('🔍 Testing specific pickup:', firstPickup.name, 'ID:', firstPickup.id);
        
        const specificResult = await getRoutesByPickup(firstPickup.id);
        console.log('🔍 Specific pickup result:', specificResult);
        
        specificPickupTest = {
          pickup: firstPickup,
          result: specificResult
        };
      }
      
      // Test 3: Process road highlights for map
      let processedRoads = [];
      if (allData.success && allData.roadHighlights.length > 0) {
        console.log('🔍 Processing road highlights for map...');
        processedRoads = processRoadHighlightsForMap(allData.roadHighlights);
        console.log('🔍 Processed roads:', processedRoads);
      }
      
      setDebugInfo({
        allData,
        specificPickupTest,
        processedRoads,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('🔍 Debug test error:', error);
      Alert.alert('Debug Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCoordinateInfo = (coordinates) => {
    if (!coordinates || !Array.isArray(coordinates)) {
      return 'No coordinates';
    }
    
    const validCoords = coordinates.filter(coord => 
      Array.isArray(coord) && coord.length >= 2 && 
      !isNaN(coord[0]) && !isNaN(coord[1])
    );
    
    return `${validCoords.length}/${coordinates.length} valid coordinates`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Road Highlight Debugger</Text>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={testRoadHighlights}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing...' : 'Test Road Highlights'}
        </Text>
      </TouchableOpacity>

      {debugInfo && (
        <ScrollView style={styles.results}>
          <Text style={styles.sectionTitle}>Debug Results ({debugInfo.timestamp})</Text>
          
          {/* All Data Section */}
          <View style={styles.section}>
            <Text style={styles.subTitle}>1. All Road Highlights Data</Text>
            <Text style={styles.text}>Success: {debugInfo.allData.success ? 'Yes' : 'No'}</Text>
            <Text style={styles.text}>Road Highlights: {debugInfo.allData.roadHighlights?.length || 0}</Text>
            <Text style={styles.text}>Pickup Points: {debugInfo.allData.pickupPoints?.length || 0}</Text>
            <Text style={styles.text}>Dropoff Points: {debugInfo.allData.dropoffPoints?.length || 0}</Text>
            
            {debugInfo.allData.roadHighlights?.slice(0, 3).map((road, index) => (
              <View key={index} style={styles.roadItem}>
                <Text style={styles.roadName}>Road {index + 1}: {road.name}</Text>
                <Text style={styles.roadDetail}>ID: {road.id}</Text>
                <Text style={styles.roadDetail}>Color: {road.stroke_color || road.color || 'None'}</Text>
                <Text style={styles.roadDetail}>Coordinates: {renderCoordinateInfo(road.road_coordinates || road.coordinates)}</Text>
                <Text style={styles.roadDetail}>Pickup ID: {road.pickup_point_id || 'None'}</Text>
              </View>
            ))}
          </View>

          {/* Specific Pickup Test */}
          {debugInfo.specificPickupTest && (
            <View style={styles.section}>
              <Text style={styles.subTitle}>2. Specific Pickup Test</Text>
              <Text style={styles.text}>Pickup: {debugInfo.specificPickupTest.pickup.name}</Text>
              <Text style={styles.text}>API Success: {debugInfo.specificPickupTest.result.success ? 'Yes' : 'No'}</Text>
              
              if (debugInfo.specificPickupTest.result.success && debugInfo.specificPickupTest.result.data) {
                const data = debugInfo.specificPickupTest.result.data;
                <Text style={styles.text}>Destinations: {data.available_destinations?.length || 0}</Text>
                <Text style={styles.text}>Road Highlights: {data.road_highlights?.length || 0}</Text>
                <Text style={styles.text}>Color: {data.color || 'None'}</Text>
                
                {data.road_highlights?.slice(0, 2).map((road, index) => (
                  <View key={index} style={styles.roadItem}>
                    <Text style={styles.roadName}>API Road {index + 1}: {road.name}</Text>
                    <Text style={styles.roadDetail}>Coordinates: {renderCoordinateInfo(road.road_coordinates)}</Text>
                  </View>
                ))}
              }
            </View>
          )}

          {/* Processed Roads */}
          <View style={styles.section}>
            <Text style={styles.subTitle}>3. Processed Roads for Map</Text>
            <Text style={styles.text}>Processed Count: {debugInfo.processedRoads.length}</Text>
            
            {debugInfo.processedRoads.slice(0, 3).map((road, index) => (
              <View key={index} style={styles.roadItem}>
                <Text style={styles.roadName}>Processed {index + 1}: {road.name}</Text>
                <Text style={styles.roadDetail}>WebView Color: {road.color}</Text>
                <Text style={styles.roadDetail}>WebView Weight: {road.weight}</Text>
                <Text style={styles.roadDetail}>WebView Coordinates: {road.coordinates?.length || 0}</Text>
                <Text style={styles.roadDetail}>Has Valid Coords: {road.coordinates?.length > 0 ? 'Yes' : 'No'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  section: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF',
  },
  text: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  roadItem: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  roadName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  roadDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default RoadHighlightDebugger;
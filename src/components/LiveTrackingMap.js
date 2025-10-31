import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import LeafletMapView from './LeafletMapView';
import { getDriverLocation } from '../services/rideHailingService';
import { apiRequest } from '../services/authService';
import { getAllRoadHighlightsWithPoints, processRoadHighlightsForMap } from '../services/roadHighlightsService';

const LiveTrackingMap = ({ ride }) => {
  const [mapData, setMapData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeData, setRouteData] = useState([]);
  const [roadHighlights, setRoadHighlights] = useState([]);

  useEffect(() => {
    if (ride.status === 'driver_assigned' && ride.driver_id) {
      loadInitialMap();
      loadRoadHighlights();
      const interval = setInterval(updateDriverLocation, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [ride]);
  
  useEffect(() => {
    if (driverLocation && mapData && mapData.pickupCoords) {
      console.log('[LiveTrackingMap] Triggering route fetch - Driver:', driverLocation, 'Pickup:', mapData.pickupCoords);
      fetchRoute(driverLocation, mapData.pickupCoords);
    }
  }, [driverLocation, mapData]);

  const loadInitialMap = async () => {
    try {
      let pickupCoords = { latitude: 10.295, longitude: 123.89 };
      let dropoffCoords = { latitude: 10.305, longitude: 123.90 };
      
      // Parse coordinates from notes
      if (ride.notes) {
        const pickupMatch = ride.notes.match(/Pickup: ([\d.-]+), ([\d.-]+)/);
        const dropoffMatch = ride.notes.match(/Dropoff: ([\d.-]+), ([\d.-]+)/);
        
        if (pickupMatch) {
          pickupCoords = {
            latitude: parseFloat(pickupMatch[1]),
            longitude: parseFloat(pickupMatch[2])
          };
        }
        
        if (dropoffMatch) {
          dropoffCoords = {
            latitude: parseFloat(dropoffMatch[1]),
            longitude: parseFloat(dropoffMatch[2])
          };
        }
      }

      setMapData({
        region: {
          latitude: pickupCoords.latitude,
          longitude: pickupCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        },
        pickupCoords,
        dropoffCoords
      });

      // Get initial driver location
      await updateDriverLocation();
    } catch (error) {
      console.error('Error loading map:', error);
    }
  };

  const loadRoadHighlights = async () => {
    try {
      console.log('[LiveTrackingMap] Loading road highlights...');
      const roadHighlightsResult = await getAllRoadHighlightsWithPoints();
      
      if (roadHighlightsResult.success && roadHighlightsResult.roadHighlights) {
        const processedRoads = processRoadHighlightsForMap(roadHighlightsResult.roadHighlights);
        console.log('[LiveTrackingMap] Loaded', processedRoads.length, 'road highlights');
        setRoadHighlights(processedRoads);
      } else {
        console.log('[LiveTrackingMap] No road highlights available');
      }
    } catch (error) {
      console.error('[LiveTrackingMap] Error loading road highlights:', error);
    }
  };

  const updateDriverLocation = async () => {
    try {
      console.log(`[LiveTrackingMap] Fetching location for driver: ${ride.driver_id}`);
      const result = await getDriverLocation(ride.driver_id);
      console.log(`[LiveTrackingMap] Location result:`, result);
      
      if (result.success && result.data) {
        const lat = parseFloat(result.data.latitude);
        const lng = parseFloat(result.data.longitude);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
          console.log('[LiveTrackingMap] Invalid driver coordinates:', lat, lng);
          return;
        }
        
        const newLocation = {
          latitude: lat,
          longitude: lng,
          speed: result.data.speed || 0,
          heading: result.data.heading || 0,
          updated_at: result.data.updated_at
        };
        
        console.log('[LiveTrackingMap] Driver location updated:', newLocation);
        setDriverLocation(newLocation);
        
        // Update map region to center on driver if this is the first location update
        if (!driverLocation && mapData) {
          setMapData(prev => ({
            ...prev,
            region: {
              latitude: newLocation.latitude,
              longitude: newLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }
          }));
        }
      } else {
        console.log('[LiveTrackingMap] No driver location found:', result.error);
      }
    } catch (error) {
      console.error('[LiveTrackingMap] Error updating driver location:', error);
    }
  };
  
  const fetchRoute = async (from, to) => {
    try {
      console.log('[LiveTrackingMap] Fetching OSRM route from:', from, 'to:', to);
      
      // Use OSRM API for proper road routing with multiple attempts
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=false&steps=false&continue_straight=default`;
      
      const response = await fetch(osrmUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[LiveTrackingMap] OSRM response code:', data.code);
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates;
        
        if (coordinates && coordinates.length > 1) {
          console.log('[LiveTrackingMap] OSRM route found with', coordinates.length, 'points');
          setRouteData([{
            coordinates: coordinates.map(coord => ({
              lat: coord[1], // OSRM returns [lng, lat]
              lng: coord[0]
            })),
            color: '#FF6B35', // Orange color for driver route
            weight: 5,
            opacity: 0.9,
            name: `Route to pickup (${Math.round(route.distance / 1000 * 10) / 10} km)`,
            id: 'driver_to_pickup'
          }]);
          return;
        }
      }
      
      console.log('[LiveTrackingMap] OSRM failed or no valid route, code:', data.code);
      // Only clear route data, don't show straight lines
      setRouteData([]);
    } catch (error) {
      console.error('[LiveTrackingMap] Error fetching OSRM route:', error.message);
      // Clear route data on error, don't show straight lines
      setRouteData([]);
    }
  };

  if (!mapData) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  const markers = [
    {
      latitude: mapData.pickupCoords.latitude,
      longitude: mapData.pickupCoords.longitude,
      title: 'Pickup Point',
      description: ride.pickup_address,
      iconColor: '#2E7D32'
    },
    {
      latitude: mapData.dropoffCoords.latitude,
      longitude: mapData.dropoffCoords.longitude,
      title: 'Destination',
      description: ride.dropoff_address,
      iconColor: '#C62828'
    }
  ];

  // Add driver marker if location is available
  if (driverLocation) {
    const lastUpdate = driverLocation.updated_at ? 
      new Date(driverLocation.updated_at).toLocaleTimeString() : 'Unknown';
    
    markers.push({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      title: `${ride.driver_name || 'Driver'}`,
      description: `Last updated: ${lastUpdate}`,
      iconColor: '#FF9800',
      type: 'driver', // This is crucial for showing the horse icon
      id: 'driver_location'
    });
  }

  return (
    <View style={styles.container}>
      <LeafletMapView
        region={mapData.region}
        markers={markers}
        roads={[...roadHighlights, ...routeData]}
        routes={[]}
        showSatellite={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LiveTrackingMap;
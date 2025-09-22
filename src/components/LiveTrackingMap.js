import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import LeafletMapView from './LeafletMapView';
import { getDriverLocation } from '../services/rideHailingService';

const LiveTrackingMap = ({ ride }) => {
  const [mapData, setMapData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => {
    if (ride.status === 'driver_assigned' && ride.driver_id) {
      loadInitialMap();
      const interval = setInterval(updateDriverLocation, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [ride]);

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
      updateDriverLocation();
    } catch (error) {
      console.error('Error loading map:', error);
    }
  };

  const updateDriverLocation = async () => {
    try {
      const result = await getDriverLocation(ride.driver_id);
      if (result.success && result.data) {
        setDriverLocation({
          latitude: result.data.latitude,
          longitude: result.data.longitude
        });
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
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

  // Add driver marker if location available
  if (driverLocation) {
    markers.push({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      title: `${ride.driver_name || 'Driver'}`,
      description: 'Your driver is here',
      iconColor: '#FF9800'
    });
  }

  return (
    <View style={styles.container}>
      <LeafletMapView
        region={mapData.region}
        markers={markers}
        roads={[]}
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
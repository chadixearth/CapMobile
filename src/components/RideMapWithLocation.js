import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import LeafletMapView from './LeafletMapView';
import * as Location from 'expo-location';

export default function RideMapWithLocation({ ride }) {
  const [mapData, setMapData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  
  useEffect(() => {
    loadMapData();
    getDriverLocation();
  }, [ride]);
  
  const getDriverLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setDriverLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      }
    } catch (error) {
      console.log('Could not get driver location:', error);
    }
  };
  
  const loadMapData = async () => {
    try {
      let pickupCoords = { latitude: 10.295, longitude: 123.89 };
      let dropoffCoords = { latitude: 10.305, longitude: 123.90 };
      
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
      
      let allLats = [pickupCoords.latitude, dropoffCoords.latitude];
      let allLngs = [pickupCoords.longitude, dropoffCoords.longitude];
      
      if (driverLocation) {
        allLats.push(driverLocation.latitude);
        allLngs.push(driverLocation.longitude);
      }
      
      const centerLat = (Math.max(...allLats) + Math.min(...allLats)) / 2;
      const centerLng = (Math.max(...allLngs) + Math.min(...allLngs)) / 2;
      const deltaLat = Math.max((Math.max(...allLats) - Math.min(...allLats)) * 1.5, 0.01);
      const deltaLng = Math.max((Math.max(...allLngs) - Math.min(...allLngs)) * 1.5, 0.01);
      
      let routes = [];
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupCoords.longitude},${pickupCoords.latitude};${dropoffCoords.longitude},${dropoffCoords.latitude}?overview=full&geometries=geojson`;
        const osrmResponse = await fetch(osrmUrl);
        
        if (osrmResponse.ok) {
          const osrmData = await osrmResponse.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            const route = osrmData.routes[0];
            routes = [{
              coordinates: route.geometry.coordinates.map(coord => ({
                latitude: coord[1],
                longitude: coord[0]
              })),
              color: '#FF9800',
              weight: 5,
              opacity: 0.8
            }];
          }
        }
      } catch (error) {
        console.log('Could not load OSRM route:', error);
      }
      
      const markers = [
        {
          latitude: pickupCoords.latitude,
          longitude: pickupCoords.longitude,
          title: 'Pickup Location',
          description: ride.pickup_address,
          iconColor: '#2E7D32'
        },
        {
          latitude: dropoffCoords.latitude,
          longitude: dropoffCoords.longitude,
          title: 'Destination',
          description: ride.dropoff_address,
          iconColor: '#C62828'
        }
      ];
      
      if (driverLocation) {
        markers.push({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          title: 'Your Location',
          description: 'Your current position',
          iconColor: '#1976D2'
        });
      }
      
      setMapData({
        region: {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: deltaLat,
          longitudeDelta: deltaLng
        },
        markers,
        roads: [],
        routes
      });
    } catch (error) {
      console.error('Error loading map data:', error);
    }
  };
  
  if (!mapData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={{ marginTop: 8, color: '#666' }}>Loading map...</Text>
      </View>
    );
  }
  
  return (
    <LeafletMapView
      region={mapData.region}
      markers={mapData.markers}
      roads={mapData.roads}
      routes={mapData.routes}
      showSatellite={false}
    />
  );
}

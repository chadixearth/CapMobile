import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import LeafletMapView from './LeafletMapView';
import * as Location from 'expo-location';
import { updateDriverLocation } from '../services/rideHailingService';
import { getCurrentUser } from '../services/authService';

export default function RideMapWithLocation({ ride }) {
  const [mapData, setMapData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    initUser();
  }, []);
  
  useEffect(() => {
    if (user) {
      getDriverLocation();
      const interval = setInterval(getDriverLocation, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);
  
  useEffect(() => {
    if (driverLocation) {
      loadMapData();
    }
  }, [driverLocation, ride]);
  
  const initUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };
  
  const getDriverLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
        setDriverLocation(newLocation);
        
        if (user?.id) {
          await updateDriverLocation(
            user.id,
            newLocation.latitude,
            newLocation.longitude,
            location.coords.speed || 0,
            location.coords.heading || 0
          );
        }
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
        // Route 1: Driver to Pickup (blue)
        if (driverLocation) {
          const driverToPickupUrl = `https://router.project-osrm.org/route/v1/driving/${driverLocation.longitude},${driverLocation.latitude};${pickupCoords.longitude},${pickupCoords.latitude}?overview=full&geometries=geojson`;
          const driverToPickupResponse = await fetch(driverToPickupUrl);
          
          if (driverToPickupResponse.ok) {
            const driverToPickupData = await driverToPickupResponse.json();
            if (driverToPickupData.routes && driverToPickupData.routes.length > 0) {
              routes.push({
                coordinates: driverToPickupData.routes[0].geometry.coordinates.map(coord => ({
                  latitude: coord[1],
                  longitude: coord[0]
                })),
                color: '#1976D2',
                weight: 5,
                opacity: 0.8
              });
            }
          }
        }
        
        // Route 2: Pickup to Dropoff (orange)
        const pickupToDropoffUrl = `https://router.project-osrm.org/route/v1/driving/${pickupCoords.longitude},${pickupCoords.latitude};${dropoffCoords.longitude},${dropoffCoords.latitude}?overview=full&geometries=geojson`;
        const pickupToDropoffResponse = await fetch(pickupToDropoffUrl);
        
        if (pickupToDropoffResponse.ok) {
          const pickupToDropoffData = await pickupToDropoffResponse.json();
          if (pickupToDropoffData.routes && pickupToDropoffData.routes.length > 0) {
            routes.push({
              coordinates: pickupToDropoffData.routes[0].geometry.coordinates.map(coord => ({
                latitude: coord[1],
                longitude: coord[0]
              })),
              color: '#FF9800',
              weight: 5,
              opacity: 0.8
            });
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

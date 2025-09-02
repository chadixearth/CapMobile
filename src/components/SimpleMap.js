import React, { useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

const SimpleMap = ({ region, markers = [] }) => {
  const [mapReady, setMapReady] = useState(false);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        mapType="standard"
        initialRegion={{
          latitude: region?.latitude || 10.3157,
          longitude: region?.longitude || 123.8854,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        loadingEnabled={true}
        onMapReady={() => {
          console.log('Simple map ready!');
          setMapReady(true);
        }}
      >
        {/* Simple markers */}
        {mapReady && markers.map((marker, index) => (
          <Marker
            key={`marker-${index}`}
            coordinate={{
              latitude: parseFloat(marker.latitude || 0),
              longitude: parseFloat(marker.longitude || 0)
            }}
            title={marker.title || 'Location'}
            description={marker.description || ''}
            pinColor="#FF0000"
          />
        ))}
      </MapView>

      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});

export default SimpleMap;

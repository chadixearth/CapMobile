import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const GoogleMap = ({ region = DEFAULT_REGION, markers = [], style, onPress, onMarkerPress }) => {
  return (
    <View style={[styles.container, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onPress={onPress}
        onMarkerPress={onMarkerPress}
      >
        {markers.map((marker, idx) => (
          <Marker
            key={marker.id || idx}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.title}
            description={marker.description}
            identifier={marker.id ? String(marker.id) : undefined}
            onPress={marker.onPress}
          />
        ))}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default GoogleMap; 
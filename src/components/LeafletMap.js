import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// Dynamic imports for web-only components
let MapContainer, TileLayer, LeafletMarker, Popup, LeafletPolyline, L;

if (Platform.OS === 'web') {
  // Import Leaflet CSS and components for web
  require('leaflet/dist/leaflet.css');
  
  const leafletComponents = require('react-leaflet');
  MapContainer = leafletComponents.MapContainer;
  TileLayer = leafletComponents.TileLayer;
  LeafletMarker = leafletComponents.Marker;
  Popup = leafletComponents.Popup;
  LeafletPolyline = leafletComponents.Polyline;
  
  L = require('leaflet');
  
  // Fix for default markers in react-leaflet
  if (typeof window !== 'undefined') {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }
}

const LeafletMap = ({ region, markers = [], roads = [], style }) => {
  console.log('LeafletMap render - Region:', region);
  console.log('LeafletMap render - Markers:', markers.length);
  console.log('LeafletMap render - Roads:', roads.length);
  console.log('LeafletMap render - Platform:', Platform.OS);

  // Process road highlights into polyline coordinates for mobile
  const processMobileRoads = (roads) => {
    return roads.map(road => {
      if (road.coordinates && Array.isArray(road.coordinates)) {
        return {
          coordinates: road.coordinates.map(coord => ({
            latitude: coord.lat || coord.latitude,
            longitude: coord.lng || coord.longitude
          })),
          strokeColor: road.color || '#007AFF',
          strokeWidth: road.weight || 4,
          strokeOpacity: road.opacity || 0.7,
          key: road.id || Math.random().toString(),
          title: road.name || 'Road Highlight'
        };
      } else if (road.start_latitude && road.start_longitude && road.end_latitude && road.end_longitude) {
        return {
          coordinates: [
            {
              latitude: parseFloat(road.start_latitude),
              longitude: parseFloat(road.start_longitude)
            },
            {
              latitude: parseFloat(road.end_latitude),
              longitude: parseFloat(road.end_longitude)
            }
          ],
          strokeColor: road.color || '#007AFF',
          strokeWidth: road.weight || 4,
          strokeOpacity: road.opacity || 0.7,
          key: road.id || Math.random().toString(),
          title: road.name || 'Road Highlight'
        };
      }
      return null;
    }).filter(Boolean);
  };

  // For mobile platforms, use react-native-maps
  if (Platform.OS !== 'web') {
    console.log('Rendering mobile map with', markers.length, 'markers');
    const processedMobileRoads = processMobileRoads(roads);
    
    return (
      <View style={[styles.container, style]}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          mapType="standard"
          initialRegion={{
            latitude: region.latitude,
            longitude: region.longitude,
            latitudeDelta: region.latitudeDelta || 0.15,
            longitudeDelta: region.longitudeDelta || 0.15,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingIndicatorColor="#007AFF"
          onMapReady={() => console.log('Map is ready!')}
          onRegionChangeComplete={(newRegion) => console.log('Region changed:', newRegion)}
        >
          {/* Map Points as Markers */}
          {markers.map((marker, index) => {
            console.log('Rendering marker:', marker.title, 'at', marker.latitude, marker.longitude);
            return (
              <Marker
                key={marker.id || index}
                coordinate={{
                  latitude: marker.latitude,
                  longitude: marker.longitude
                }}
                title={marker.title}
                description={marker.description}
                pinColor="red"
              />
            );
          })}

          {/* Road Highlights as Polylines */}
          {processedMobileRoads.map((road, index) => (
            <Polyline
              key={road.key || index}
              coordinates={road.coordinates}
              strokeColor={road.strokeColor}
              strokeWidth={road.strokeWidth}
              strokeOpacity={road.strokeOpacity}
            />
          ))}
        </MapView>
      </View>
    );
  }

  // Create custom icons based on point type and color
  const createCustomIcon = (pointType, iconColor) => {
    const color = iconColor || '#FF0000';
    
    // Different icons based on point type
    const iconHtml = pointType === 'pickup' || pointType === 'station' 
      ? `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
      : `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 2px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
    
    return L.divIcon({
      html: iconHtml,
      className: 'custom-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });
  };

  // Process road highlights into polyline coordinates
  const processRoads = (roads) => {
    return roads.map(road => {
      // Assuming road.coordinates is an array of [lat, lng] pairs
      // or road has start/end coordinates
      if (road.coordinates && Array.isArray(road.coordinates)) {
        return {
          positions: road.coordinates.map(coord => [coord.lat || coord.latitude, coord.lng || coord.longitude]),
          color: road.color || '#007AFF',
          weight: road.weight || 4,
          opacity: road.opacity || 0.7,
          id: road.id,
          name: road.name
        };
      } else if (road.start_latitude && road.start_longitude && road.end_latitude && road.end_longitude) {
        return {
          positions: [
            [parseFloat(road.start_latitude), parseFloat(road.start_longitude)],
            [parseFloat(road.end_latitude), parseFloat(road.end_longitude)]
          ],
          color: road.color || '#007AFF',
          weight: road.weight || 4,
          opacity: road.opacity || 0.7,
          id: road.id,
          name: road.name
        };
      }
      return null;
    }).filter(Boolean);
  };

  const processedRoads = processRoads(roads);

  return (
    <View style={[styles.container, style]}>
      <MapContainer
        center={[region.latitude, region.longitude]}
        zoom={13}
        style={styles.map}
        scrollWheelZoom={true}
      >
        {/* Tile Layer - Using OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Map Points as Markers */}
        {markers.map((marker, index) => (
          <LeafletMarker
            key={marker.id || index}
            position={[marker.latitude, marker.longitude]}
            icon={createCustomIcon(marker.pointType, marker.iconColor)}
          >
            <Popup>
              <div>
                <strong>{marker.title}</strong>
                {marker.description && <p>{marker.description}</p>}
                <small>Type: {marker.pointType}</small>
              </div>
            </Popup>
          </LeafletMarker>
        ))}

        {/* Road Highlights as Polylines */}
        {processedRoads.map((road, index) => (
          <LeafletPolyline
            key={road.id || index}
            positions={road.positions}
            color={road.color}
            weight={road.weight}
            opacity={road.opacity}
          >
            <Popup>
              <div>
                <strong>{road.name || 'Road Highlight'}</strong>
              </div>
            </Popup>
          </LeafletPolyline>
        ))}
      </MapContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  map: {
    height: '100%',
    width: '100%',
  },
});

export default LeafletMap;

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

// Map tile providers (all free, no API key required)
// Updated URLs for better reliability
const MAP_PROVIDERS = {
  OSM_STANDARD: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    name: 'OpenStreetMap Standard',
    maxZoom: 19,
  },
  OSM_HOT: {
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    name: 'Humanitarian OSM',
    maxZoom: 19,
  },
  CARTO_LIGHT: {
    url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    name: 'CartoDB Light',
    maxZoom: 20,
  },
  CARTO_DARK: {
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    name: 'CartoDB Dark',
    maxZoom: 20,
  },
  CARTO_VOYAGER: {
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    name: 'CartoDB Voyager',
    maxZoom: 20,
  },
  STAMEN_TONER: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    name: 'Stamen Toner',
    maxZoom: 20,
  },
  STAMEN_TERRAIN: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.jpg',
    name: 'Stamen Terrain',
    maxZoom: 18,
  },
  ESRI_WORLD_IMAGERY: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    name: 'ESRI Satellite',
    maxZoom: 19,
  },
  ESRI_WORLD_STREET: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    name: 'ESRI Street Map',
    maxZoom: 19,
  }
};

const UniversalMap = ({ 
  region, 
  markers = [], 
  roads = [], 
  routes = [],
  zones = [],
  style,
  mapStyle = 'standard', 
  showSatellite = false 
}) => {
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Trigger re-render when satellite mode changes
    console.log('Map type changed:', showSatellite ? 'satellite' : 'standard');
  }, [showSatellite]);

  // Process road highlights into polyline coordinates
  const processRoads = (roads) => {
    return roads.map(road => {
      if (road.coordinates && Array.isArray(road.coordinates)) {
        return {
          coordinates: road.coordinates.map(coord => ({
            latitude: parseFloat(coord.lat || coord.latitude || 0),
            longitude: parseFloat(coord.lng || coord.longitude || 0)
          })),
          strokeColor: road.color || '#007AFF',
          strokeWidth: parseInt(road.weight || 4),
          key: road.id || Math.random().toString(),
          title: road.name || 'Road'
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
          strokeWidth: parseInt(road.weight || 4),
          key: road.id || Math.random().toString(),
          title: road.name || 'Road'
        };
      }
      return null;
    }).filter(Boolean);
  };

  // Custom marker colors based on type
  const getMarkerColor = (pointType) => {
    switch(pointType) {
      case 'pickup':
        return '#FF0000'; // Red
      case 'station':
      case 'terminal':
        return '#00AA00'; // Green
      case 'landmark':
        return '#0066CC'; // Blue
      default:
        return '#FF6600'; // Orange
    }
  };

  const processedRoads = processRoads(roads);

  // For web platform, use WebView with Leaflet
  if (Platform.OS === 'web') {
    // Create HTML content for web map
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${region.latitude}, ${region.longitude}], 13);
          
          // Add tile layer
          L.tileLayer('${currentProvider.url}', {
            maxZoom: ${currentProvider.maxZoom},
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          
          // Add markers
          ${markers.map(marker => `
            L.marker([${marker.latitude}, ${marker.longitude}])
              .addTo(map)
              .bindPopup('<b>${marker.title || ''}</b><br>${marker.description || ''}');
          `).join('')}
          
          // Add polylines
          ${processedRoads.map(road => `
            L.polyline(${JSON.stringify(road.coordinates.map(c => [c.latitude, c.longitude]))}, {
              color: '${road.strokeColor}',
              weight: ${road.strokeWidth}
            }).addTo(map);
          `).join('')}
        </script>
      </body>
      </html>
    `;

    return (
      <View style={[styles.container, style]}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Map"
        />
      </View>
    );
  }

  // For mobile platforms, use standard react-native-maps
  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        mapType={showSatellite ? 'satellite' : 'standard'}
        initialRegion={{
          latitude: region.latitude || 10.3157,
          longitude: region.longitude || 123.8854,
          latitudeDelta: region.latitudeDelta || 0.15,
          longitudeDelta: region.longitudeDelta || 0.15,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        showsBuildings={true}
        showsTraffic={false}
        showsIndoors={true}
        loadingEnabled={true}
        loadingIndicatorColor="#007AFF"
        onMapReady={() => {
          console.log('Map is ready!');
          setMapReady(true);
          setTimeout(() => {
            setMapLoaded(true);
          }, 500);
        }}
        onRegionChangeComplete={(newRegion) => {
          console.log('Region changed:', newRegion);
        }}
      >

        {/* Map Points as Markers */}
        {mapLoaded && markers.map((marker, index) => {
          const markerColor = marker.iconColor || getMarkerColor(marker.pointType);
          
          // Create description with images if available
          let description = marker.description || '';
          if (marker.image_urls && marker.image_urls.length > 0) {
            description += `\n📷 ${marker.image_urls.length} image(s) available`;
          }
          
          return (
            <Marker
              key={marker.id || `marker-${index}`}
              coordinate={{
                latitude: parseFloat(marker.latitude || 0),
                longitude: parseFloat(marker.longitude || 0)
              }}
              title={marker.title || marker.name || 'Location'}
              description={description}
              pinColor={markerColor}
              tracksViewChanges={false} // Performance optimization
            />
          );
        })}

        {/* Road Highlights as Polylines */}
        {mapLoaded && processedRoads.map((road, index) => (
          <Polyline
            key={road.key || `road-${index}`}
            coordinates={road.coordinates}
            strokeColor={road.strokeColor}
            strokeWidth={road.strokeWidth}
            lineDashPattern={road.dashed ? [10, 5] : null}
          />
        ))}

        {/* Routes as different colored polylines */}
        {mapLoaded && routes.map((route, index) => {
          if (!route.coordinates || !Array.isArray(route.coordinates)) return null;
          
          const routeCoords = route.coordinates.map(coord => ({
            latitude: parseFloat(coord.lat || coord.latitude || 0),
            longitude: parseFloat(coord.lng || coord.longitude || 0)
          }));

          return (
            <Polyline
              key={`route-${index}`}
              coordinates={routeCoords}
              strokeColor={route.color || '#FF00FF'}
              strokeWidth={route.weight || 5}
              lineDashPattern={[15, 10]}
            />
          );
        })}
      </MapView>

      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
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
  loadingSubText: {
    marginTop: 5,
    fontSize: 12,
    color: '#999',
  },
});

export default UniversalMap;

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

const LeafletMapView = ({ 
  region, 
  markers = [], 
  roads = [], 
  routes = [],
  showSatellite = false,
  onMarkerPress,
  onMapPress,
  style 
}) => {
  const webViewRef = useRef(null);

  // Generate the HTML for the Leaflet map
  const generateMapHTML = () => {
    const center = {
      lat: region?.latitude || 10.3157,
      lng: region?.longitude || 123.8854,
      zoom: region?.zoom || 13
    };

    // Convert markers to JSON string
    const markersJSON = JSON.stringify(markers.map(marker => ({
      lat: parseFloat(marker.latitude || 0),
      lng: parseFloat(marker.longitude || 0),
      title: marker.title || marker.name || 'Location',
      description: marker.description || '',
      color: marker.iconColor || marker.color || '#FF0000',
      type: marker.pointType || marker.type || 'default'
    })));

    // Convert roads to JSON string
    const roadsJSON = JSON.stringify(roads.map(road => {
      if (road.road_coordinates && Array.isArray(road.road_coordinates)) {
        return {
          coordinates: road.road_coordinates.map(coord => ({
            lat: parseFloat(coord.lat || coord.latitude || 0),
            lng: parseFloat(coord.lng || coord.longitude || 0)
          })),
          color: road.stroke_color || road.color || '#007AFF',
          weight: road.stroke_width || road.weight || 4,
          opacity: road.stroke_opacity || road.opacity || 0.7,
          name: road.name || 'Road'
        };
      } else if (road.coordinates && Array.isArray(road.coordinates)) {
        return {
          coordinates: road.coordinates.map(coord => ({
            lat: parseFloat(coord.lat || coord.latitude || 0),
            lng: parseFloat(coord.lng || coord.longitude || 0)
          })),
          color: road.color || '#007AFF',
          weight: road.weight || 4,
          opacity: road.opacity || 0.7,
          name: road.name || 'Road'
        };
      } else if (road.start_latitude && road.start_longitude && road.end_latitude && road.end_longitude) {
        return {
          coordinates: [
            { lat: parseFloat(road.start_latitude), lng: parseFloat(road.start_longitude) },
            { lat: parseFloat(road.end_latitude), lng: parseFloat(road.end_longitude) }
          ],
          color: road.color || '#007AFF',
          weight: road.weight || 4,
          opacity: road.opacity || 0.7,
          name: road.name || 'Road'
        };
      }
      return null;
    }).filter(Boolean));

    const tileLayer = showSatellite 
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
              integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
              crossorigin="" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" 
                crossorigin=""></script>
        <style>
          * {
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          #map {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: #f0f0f0;
          }
          /* Improve marker rendering */
          .leaflet-marker-icon {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
          /* Improve tile rendering */
          .leaflet-tile {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }
          .leaflet-container {
            background: #ddd;
            font-size: 14px;
          }
          /* Custom popup styling */
          .leaflet-popup-content {
            margin: 13px 19px;
            line-height: 1.4;
            font-size: 14px;
          }
          .leaflet-popup-content strong {
            font-weight: 600;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Initialize the map with better rendering options
          var map = L.map('map', {
            center: [${center.lat}, ${center.lng}],
            zoom: ${center.zoom},
            zoomControl: true,
            attributionControl: false,
            preferCanvas: false, // Use SVG for sharper rendering
            renderer: L.svg(),
            zoomAnimation: true,
            fadeAnimation: true,
            markerZoomAnimation: true,
            wheelDebounceTime: 40,
            wheelPxPerZoomLevel: 60,
            tap: true,
            tapTolerance: 15,
            touchZoom: true,
            bounceAtZoomLimits: true
          });

          // Add tile layer with better quality settings
          L.tileLayer('${tileLayer}', {
            maxZoom: 19,
            minZoom: 2,
            attribution: '© OpenStreetMap contributors',
            tileSize: 256,
            zoomOffset: 0,
            detectRetina: true, // Enable high-DPI support
            updateWhenIdle: false,
            updateWhenZooming: false,
            keepBuffer: 2,
            crossOrigin: true
          }).addTo(map);

          // Parse data
          var markers = ${markersJSON};
          var roads = ${roadsJSON};

          // Function to get marker color
          function getMarkerIcon(color, type) {
            var iconColors = {
              '#FF0000': 'red',
              '#00FF00': 'green',
              '#0000FF': 'blue',
              '#FFFF00': 'gold',
              '#FF6600': 'orange',
              '#800080': 'violet',
              '#00AA00': 'green',
              '#0066CC': 'blue'
            };
            
            var colorName = iconColors[color] || 'red';
            
            // Create custom icon
            return L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-' + colorName + '.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            });
          }

          // Add markers to map
          markers.forEach(function(marker) {
            if (marker.lat && marker.lng) {
              var leafletMarker = L.marker([marker.lat, marker.lng], {
                icon: getMarkerIcon(marker.color, marker.type)
              }).addTo(map);
              
              // Add click handler for marker selection
              leafletMarker.on('click', function(e) {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'markerClick',
                    marker: {
                      latitude: marker.lat,
                      longitude: marker.lng,
                      title: marker.title,
                      description: marker.description,
                      pointType: marker.type,
                      iconColor: marker.color
                    }
                  }));
                }
              });
              
              if (marker.title || marker.description) {
                var popupContent = '<div>';
                if (marker.title) {
                  popupContent += '<strong>' + marker.title + '</strong>';
                }
                if (marker.description) {
                  popupContent += '<br>' + marker.description;
                }
                popupContent += '</div>';
                leafletMarker.bindPopup(popupContent);
              }
            }
          });

          // Add roads/polylines to map
          roads.forEach(function(road) {
            if (road.coordinates && road.coordinates.length > 0) {
              var latlngs = road.coordinates.map(function(coord) {
                return [coord.lat, coord.lng];
              });
              
              var polyline = L.polyline(latlngs, {
                color: road.color,
                weight: road.weight,
                opacity: road.opacity
              }).addTo(map);
              
              if (road.name) {
                polyline.bindPopup('<strong>' + road.name + '</strong>');
              }
            }
          });

          // Send message when map is ready
          setTimeout(function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
            }
          }, 1000);

          // Handle map clicks
          map.on('click', function(e) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapClick',
                latitude: e.latlng.lat,
                longitude: e.latlng.lng
              }));
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady') {
        console.log('Leaflet map is ready');
      } else if (data.type === 'mapClick' && onMapPress) {
        onMapPress({ latitude: data.latitude, longitude: data.longitude });
      } else if (data.type === 'markerClick' && onMarkerPress) {
        onMarkerPress(data.marker);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
        onError={(error) => {
          console.error('WebView error:', error);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});

export default LeafletMapView;

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

    console.log('🗺️ Generating map HTML with:', {
      center,
      markersCoount: markers.length,
      roadsCount: roads.length,
      routesCount: routes.length
    });

    // Convert markers to JSON string
    const markersJSON = JSON.stringify(markers.map(marker => {
      const processedMarker = {
        lat: parseFloat(marker.latitude || 0),
        lng: parseFloat(marker.longitude || 0),
        title: marker.title || marker.name || 'Location',
        description: marker.description || '',
        color: marker.iconColor || marker.color || '#FF0000',
        type: marker.type || marker.pointType || 'default',
        image_urls: marker.image_urls || [],
        id: marker.id,
        isDriver: marker.isDriver || marker.type === 'driver' || marker.pointType === 'driver'
      };
      
      // Debug driver markers
      if (processedMarker.type === 'driver' || processedMarker.isDriver) {
        console.log('🐎 Processing driver marker:', processedMarker);
      }
      
      return processedMarker;
    }));

    console.log('🎯 Processed markers for WebView:', markers.length, 'markers');

    // Convert routes to JSON string
    const routesJSON = JSON.stringify(routes.map(route => ({
      coordinates: route.coordinates || [],
      color: route.color || '#FF9800',
      weight: route.weight || 5,
      opacity: route.opacity || 0.8
    })));

    // Convert roads to JSON string with proper coordinate handling
    const roadsJSON = JSON.stringify(roads.map(road => {
      console.log('🗺️ Processing road for WebView:', {
        name: road.name,
        id: road.id,
        hasRoadCoordinates: !!road.road_coordinates,
        hasCoordinates: !!road.coordinates,
        roadCoordinatesLength: road.road_coordinates?.length,
        coordinatesLength: road.coordinates?.length,
        sampleCoord: road.road_coordinates?.[0] || road.coordinates?.[0]
      });
      
      // Try both coordinate formats
      let coordinates = road.coordinates || road.road_coordinates;
      
      if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
        const processedCoordinates = coordinates.map(coord => {
          // Handle {lat, lng} format
          if (coord && typeof coord === 'object' && coord.lat !== undefined && coord.lng !== undefined) {
            return { lat: parseFloat(coord.lat), lng: parseFloat(coord.lng) };
          }
          // Handle [lat, lng] array format
          if (Array.isArray(coord) && coord.length >= 2) {
            return { lat: parseFloat(coord[0]), lng: parseFloat(coord[1]) };
          }
          return null;
        }).filter(coord => coord && !isNaN(coord.lat) && !isNaN(coord.lng));
        
        if (processedCoordinates.length > 0) {
          console.log('🗺️ Successfully processed coordinates for:', road.name, processedCoordinates.length, 'points');
          return {
            coordinates: processedCoordinates,
            color: road.color || road.stroke_color || '#007AFF',
            weight: road.weight || road.stroke_width || 4,
            opacity: road.opacity || road.stroke_opacity || 0.8,
            name: road.name || 'Road',
            id: road.id
          };
        }
      }
      
      console.log('🗺️ Road has no valid coordinates, skipping:', road.name);
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
          /* Custom marker styling */
          .custom-marker-icon {
            border: none !important;
            background: transparent !important;
          }
          .custom-marker-icon div {
            transition: transform 0.2s ease;
          }
          .custom-marker-icon:hover div {
            transform: scale(1.1);
          }
          /* Driver marker animation */
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
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

          // Parse data and log immediately
          var markers = ${markersJSON};
          var roads = ${roadsJSON};
          var routes = ${routesJSON};
          
          console.log('🚀 WebView started with data:');
          console.log('📍 Markers:', markers.length);
          console.log('🛣️ Roads:', roads.length);
          console.log('🗺️ Routes:', routes.length);
          
          // Send status to React Native
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'webViewStatus',
              markers: markers.length,
              roads: roads.length
            }));
          }
          
          console.log('🛣️ Parsed roads for WebView:', roads.length, 'roads');
          roads.forEach(function(road, index) {
            console.log('🛣️ Road', index + 1, ':', road.name, '- Coordinates:', road.coordinates?.length || 0, '- Color:', road.color);
            if (road.coordinates && road.coordinates.length > 0) {
              console.log('   🛣️ First coord:', road.coordinates[0], 'Last coord:', road.coordinates[road.coordinates.length - 1]);
            }
          });

          // Custom markers with icons
          function getMarkerIcon(color, type, id, label) {
            var iconHtml = '';
            var iconSize = [32, 32];
            var iconAnchor = [16, 16];
            
            console.log('getMarkerIcon called with - color:', color, 'type:', type, 'id:', id);
            
            if (type === 'driver' || id?.toString().includes('driver')) {
              console.log('🐎 Creating HORSE ICON for driver marker');
              // Horse icon for drivers - make it more prominent
              iconHtml = '<div style="background-color: ' + color + '; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 3px 10px rgba(0,0,0,0.4); animation: pulse 2s infinite;">🐎</div>';
              iconSize = [36, 36];
              iconAnchor = [18, 18];
            } else if (label) {
              console.log('Creating numbered marker icon:', label);
              // Numbered marker
              iconHtml = '<div style="background-color: ' + color + '; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; color: white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">' + label + '</div>';
            } else {
              console.log('Creating regular marker icon for type:', type);
              // Regular colored circle for other markers
              iconHtml = '<div style="background-color: ' + color + '; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.2);"></div>';
            }
            
            return L.divIcon({
              html: iconHtml,
              iconSize: iconSize,
              iconAnchor: iconAnchor,
              className: 'custom-marker-icon'
            });
          }

          // Add markers to map
          console.log('📍 Adding', markers.length, 'markers to map');
          var addedMarkers = 0;
          
          markers.forEach(function(marker, index) {
            console.log('Processing marker', index + 1, ':', marker.title, 'at', marker.lat, marker.lng, 'type:', marker.type, 'id:', marker.id);
            
            // Debug driver markers specifically
            if (marker.type === 'driver' || marker.isDriver || (marker.id && marker.id.toString().includes('driver'))) {
              console.log('🐎 DRIVER MARKER DETECTED:', marker.title, 'type:', marker.type, 'id:', marker.id, 'isDriver:', marker.isDriver);
            }
            
            if (marker.lat && marker.lng && !isNaN(marker.lat) && !isNaN(marker.lng)) {
              try {
                var leafletMarker = L.marker([marker.lat, marker.lng], {
                  icon: getMarkerIcon(marker.color, marker.type, marker.id, marker.label)
                }).addTo(map);
                
                addedMarkers++;
                console.log('✅ Added marker:', marker.title, 'at', marker.lat, marker.lng);
                
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
                        iconColor: marker.color,
                        image_urls: marker.image_urls || [],
                        id: marker.id,
                        isDriver: marker.type === 'driver'
                      }
                    }));
                  }
                });
                
                if (marker.title || marker.description) {
                  var popupContent = '<div style="text-align: center; min-width: 150px;">';
                  if (marker.type === 'driver' || marker.isDriver || (marker.id && marker.id.toString().includes('driver'))) {
                    popupContent += '<div style="font-size: 24px; margin-bottom: 8px;">🐎</div>';
                    popupContent += '<div style="color: #FF6B35; font-weight: bold; margin-bottom: 5px;">Tartanilla Driver</div>';
                  }
                  if (marker.title) {
                    popupContent += '<strong>' + marker.title + '</strong>';
                  }
                  if (marker.description) {
                    popupContent += '<br><div style="font-size: 12px; color: #666; margin-top: 4px;">' + marker.description + '</div>';
                  }
                  if (marker.type === 'driver' || marker.isDriver || (marker.id && marker.id.toString().includes('driver'))) {
                    popupContent += '<br><small style="color: #FF6B35; font-weight: 500;">Available for booking</small>';
                  }
                  popupContent += '</div>';
                  leafletMarker.bindPopup(popupContent);
                }
              } catch (error) {
                console.error('❌ Error adding marker:', marker.title, error);
              }
            } else {
              console.warn('⚠️ Skipping invalid marker:', marker.title, 'coords:', marker.lat, marker.lng);
            }
          });
          
          console.log('📍 Total markers added:', addedMarkers, 'out of', markers.length);
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'markerStatus',
              added: addedMarkers,
              total: markers.length
            }));
          }

          // Function to get route between two points using OSRM
          function getRoute(start, end, callback) {
            var url = 'https://router.project-osrm.org/route/v1/driving/' + 
                     start.lng + ',' + start.lat + ';' + end.lng + ',' + end.lat + 
                     '?overview=full&geometries=geojson';
            
            console.log('Getting route from OSRM:', url);
            
            fetch(url)
              .then(function(response) { return response.json(); })
              .then(function(data) {
                console.log('OSRM response:', data);
                if (data.routes && data.routes.length > 0) {
                  var route = data.routes[0];
                  var coordinates = route.geometry.coordinates.map(function(coord) {
                    return [coord[1], coord[0]]; // OSRM returns [lng, lat], Leaflet expects [lat, lng]
                  });
                  console.log('Route coordinates:', coordinates.length, 'points');
                  callback(coordinates);
                } else {
                  console.log('No routes found, using straight line');
                  // Fallback to straight line if routing fails
                  callback([[start.lat, start.lng], [end.lat, end.lng]]);
                }
              })
              .catch(function(error) {
                console.log('Routing error:', error);
                // Fallback to straight line
                callback([[start.lat, start.lng], [end.lat, end.lng]]);
              });
          }

          // Add roads/polylines to map
          var allRoadCoords = [];
          
          console.log('🛣️ Processing roads in WebView:', roads.length, 'roads');
          
          console.log('🛣️ Adding', roads.length, 'roads to map');
          var addedRoads = 0;
          
          roads.forEach(function(road, index) {
            console.log('🛣️ Processing road', index + 1, ':', road.name);
            
            // Try both coordinate formats
            var coordinates = road.coordinates || road.road_coordinates;
            console.log('🛣️ Road coordinates:', coordinates ? coordinates.length : 0, 'points');
            
            if (coordinates && coordinates.length > 0) {
              try {
                var latlngs = coordinates.map(function(coord) {
                  // Handle both [lat, lng] and {lat, lng} formats
                  if (Array.isArray(coord)) {
                    return [coord[0], coord[1]];
                  } else if (coord.lat !== undefined && coord.lng !== undefined) {
                    return [coord.lat, coord.lng];
                  } else {
                    console.warn('🛣️ Invalid coordinate format:', coord);
                    return null;
                  }
                }).filter(function(coord) { return coord !== null; });
                
                if (latlngs.length > 0) {
                  allRoadCoords = allRoadCoords.concat(latlngs);
                  
                  var polyline = L.polyline(latlngs, {
                    color: road.color || road.stroke_color || '#007AFF',
                    weight: road.weight || road.stroke_width || 4,
                    opacity: road.opacity || road.stroke_opacity || 0.8
                  }).addTo(map);
                  
                  addedRoads++;
                  console.log('✅ ROAD ADDED:', road.name, 'with', latlngs.length, 'points', 'color:', road.color || road.stroke_color);
                  
                  if (road.name) {
                    polyline.bindPopup('<strong>' + road.name + '</strong>');
                  }
                } else {
                  console.log('❌ ROAD SKIPPED - NO VALID COORDINATES:', road.name);
                }
              } catch (error) {
                console.error('❌ Error adding road:', road.name, error);
              }
            } else {
              console.log('❌ ROAD SKIPPED - NO COORDINATES:', road.name);
            }
          });
          
          console.log('🛣️ Total roads added:', addedRoads, 'out of', roads.length);
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'roadStatus',
              added: addedRoads,
              total: roads.length
            }));
          }

          // Add OSRM routes to map
          console.log('🗺️ Adding', routes.length, 'OSRM routes to map');
          var addedRoutes = 0;
          
          routes.forEach(function(route, index) {
            console.log('🗺️ Processing route', index + 1);
            
            if (route.coordinates && route.coordinates.length > 0) {
              try {
                var latlngs = route.coordinates.map(function(coord) {
                  return [coord.latitude, coord.longitude];
                });
                
                if (latlngs.length > 0) {
                  allRoadCoords = allRoadCoords.concat(latlngs);
                  
                  var polyline = L.polyline(latlngs, {
                    color: route.color || '#FF9800',
                    weight: route.weight || 5,
                    opacity: route.opacity || 0.8
                  }).addTo(map);
                  
                  addedRoutes++;
                  console.log('✅ ROUTE ADDED with', latlngs.length, 'points');
                }
              } catch (error) {
                console.error('❌ Error adding route:', error);
              }
            }
          });
          
          console.log('🗺️ Total routes added:', addedRoutes, 'out of', routes.length);
          
          // Fit bounds for all coordinates
          var allCoords = [];
          

          
          // Add marker coordinates
          markers.forEach(function(marker) {
            if (marker.lat && marker.lng) {
              allCoords.push([marker.lat, marker.lng]);
            }
          });
          
          // Add road coordinates
          allCoords = allCoords.concat(allRoadCoords);
          
          console.log('📐 Total coordinates for bounds:', allCoords.length);
          console.log('📐 Marker coords:', allCoords.length - allRoadCoords.length);
          console.log('📐 Road coords:', allRoadCoords.length);
          
          if (allCoords.length > 1) {
            var group = new L.featureGroup();
            allCoords.forEach(function(coord) {
              L.marker(coord).addTo(group);
            });
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
          } else if (allCoords.length === 1) {
            map.setView(allCoords[0], 15);
          }



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
                coordinate: {
                  latitude: e.latlng.lat,
                  longitude: e.latlng.lng
                }
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
        console.log('🗺️ Leaflet map is ready');
      } else if (data.type === 'webViewStatus') {
        console.log('🗺️ WebView Status - Markers:', data.markers, 'Roads:', data.roads);
      } else if (data.type === 'markerStatus') {
        console.log('📍 Marker Status:', data.added, '/', data.total, 'markers added');
      } else if (data.type === 'roadStatus') {
        console.log('🛣️ Road Status:', data.added, '/', data.total, 'roads added');
      } else if (data.type === 'mapClick' && onMapPress) {
        onMapPress({ nativeEvent: data });
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
        onLoadStart={() => console.log('WebView loading started')}
        onLoadEnd={() => console.log('WebView loading ended')}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error:', nativeEvent);
        }}
        onConsoleMessage={(event) => {
          const message = event.nativeEvent.message;
          console.log('🗺️ WebView:', message);
        }}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
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

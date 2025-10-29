import { apiRequest } from './authService';
import { fetchMapData } from './map/fetchMap';

export async function getRoadHighlights() {
  try {
    // Use the same map data source as MapViewScreen
    const mapData = await fetchMapData({ forceRefresh: false });
    
    if (mapData && mapData.roads && Array.isArray(mapData.roads)) {
      console.log('Found', mapData.roads.length, 'roads from map data');
      
      // Convert map roads to road highlights format
      const roadHighlights = mapData.roads.map(road => ({
        id: road.id,
        name: road.name || 'Road',
        coordinates: road.road_coordinates || [],
        stroke_color: road.stroke_color || '#007AFF',
        highlight_type: road.highlight_type || 'available'
      }));
      
      return roadHighlights;
    }
    
    console.warn('No roads found in map data');
    return [];
  } catch (error) {
    console.error('Error fetching road highlights:', error);
    return [];
  }
}

// Fetch all road highlights with their associated pickup and dropoff points
export async function getAllRoadHighlightsWithPoints() {
  try {
    // Try the dedicated endpoint first
    try {
      const result = await apiRequest('/ride-hailing/all-routes-with-points/');
      
      if (result.success && result.data) {
        return {
          success: true,
          roadHighlights: result.data.road_highlights || [],
          pickupPoints: result.data.pickup_points || [],
          dropoffPoints: result.data.dropoff_points || []
        };
      }
    } catch (endpointError) {
      console.log('Dedicated endpoint not available, using fallback approach');
    }
    
    // Fallback: Use existing map data and enhance it
    const mapData = await fetchMapData({ forceRefresh: false });
    
    if (!mapData || !mapData.points) {
      return {
        success: false,
        roadHighlights: [],
        pickupPoints: [],
        dropoffPoints: []
      };
    }
    
    // Separate pickup and dropoff points from map data
    const pickupPoints = mapData.points.filter(point => 
      point.point_type === 'pickup' || point.point_type === 'terminal'
    );
    
    const dropoffPoints = mapData.points.filter(point => 
      point.point_type === 'dropoff' || point.point_type === 'destination' || point.point_type === 'station'
    );
    
    // Use roads from map data as fallback only
    const roadHighlights = mapData.roads || [];
    
    // Get actual road highlights using the working API (same as when pickup points are clicked)
    const enhancedRoadHighlights = await enhanceRoadHighlightsWithAssociations(
      roadHighlights, 
      pickupPoints, 
      dropoffPoints
    );
    
    console.log('Fallback road highlights data:', {
      roadHighlights: enhancedRoadHighlights.length,
      pickupPoints: pickupPoints.length,
      dropoffPoints: dropoffPoints.length
    });
    
    return {
      success: true,
      roadHighlights: enhancedRoadHighlights,
      pickupPoints: pickupPoints,
      dropoffPoints: dropoffPoints
    };
  } catch (error) {
    console.error('Error fetching road highlights with points:', error);
    return {
      success: false,
      roadHighlights: [],
      pickupPoints: [],
      dropoffPoints: [],
      error: error.message
    };
  }
}

// Enhance road highlights by fetching actual route data from the working API
async function enhanceRoadHighlightsWithAssociations(roadHighlights, pickupPoints, dropoffPoints) {
  console.log('Enhancing road highlights using working API for', pickupPoints.length, 'pickup points');
  
  const allRoadHighlights = [];
  
  // Use direct API call to get routes for each pickup
  for (const pickup of pickupPoints) {
    try {
      console.log('Fetching routes for pickup:', pickup.name, 'ID:', pickup.id);
      
      // Direct API call to the working endpoint
      const result = await apiRequest(`/ride-hailing/routes-by-pickup/${pickup.id}/`);
      
      if (result && result.success && result.data) {
        const data = result.data.data || result.data || {};
        const { road_highlights = [], color } = data;
        
        console.log('Got', road_highlights.length, 'road highlights for pickup', pickup.name, 'with color', color);
        
        // Process each road highlight from the API
        road_highlights.forEach(road => {
          const processedRoad = {
            id: road.id,
            name: road.name || 'Route',
            road_coordinates: road.road_coordinates || [],
            stroke_color: color || road.stroke_color || '#007AFF',
            stroke_width: road.stroke_width || 4,
            stroke_opacity: road.stroke_opacity || 0.7,
            highlight_type: road.highlight_type || 'route',
            pickup_point_id: pickup.id,
            dropoff_point_id: road.dropoff_point_id
          };
          
          allRoadHighlights.push(processedRoad);
        });
      } else {
        console.log('No routes found for pickup:', pickup.name);
      }
    } catch (error) {
      console.error('Error fetching routes for pickup', pickup.name, ':', error);
    }
  }
  
  console.log('Total enhanced road highlights:', allRoadHighlights.length);
  return allRoadHighlights;
}

// Find nearest point to given coordinates
function findNearestPoint(points, latitude, longitude) {
  if (!Array.isArray(points) || points.length === 0) return null;
  
  let nearestPoint = null;
  let minDistance = Infinity;
  
  points.forEach(point => {
    if (!point.latitude || !point.longitude) return;
    
    const distance = calculateDistance(
      latitude, 
      longitude, 
      parseFloat(point.latitude), 
      parseFloat(point.longitude)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = {
        ...point,
        distance: distance
      };
    }
  });
  
  return nearestPoint;
}

// Process road highlights data for map display
export function processRoadHighlightsForMap(roadHighlights) {
  if (!Array.isArray(roadHighlights)) return [];
  
  return roadHighlights.map(road => {
    let coordinates = road.coordinates || road.road_coordinates;
    
    // Parse coordinates if they're in string format
    if (typeof coordinates === 'string') {
      try {
        coordinates = JSON.parse(coordinates);
      } catch (e) {
        console.warn('Failed to parse road coordinates:', e);
        coordinates = [];
      }
    }
    
    return {
      id: road.id,
      name: road.name || 'Route',
      road_coordinates: coordinates || [],
      stroke_color: road.color || road.stroke_color || '#007AFF',
      stroke_width: road.weight || road.stroke_width || 4,
      stroke_opacity: road.opacity || road.stroke_opacity || 0.7,
      highlight_type: road.highlight_type || 'route',
      pickup_point_id: road.pickup_point_id,
      dropoff_point_id: road.dropoff_point_id
    };
  });
}

// Calculate distance between two points
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Find nearest road highlight point to given coordinates
export function findNearestRoadPoint(roads, latitude, longitude, maxDistance = Infinity) {
  console.log('Finding nearest road from', roads.length, 'roads for location:', latitude, longitude);
  
  let nearestPoint = null;
  let minDistance = maxDistance;

  roads.forEach((road, index) => {
    console.log(`Road ${index + 1}:`, {
      name: road.name,
      hasCoordinates: !!road.coordinates,
      hasRoadCoordinates: !!road.road_coordinates,
      coordType: typeof (road.coordinates || road.road_coordinates),
      coordLength: (road.coordinates || road.road_coordinates)?.length,
      actualCoords: road.coordinates,
      actualRoadCoords: road.road_coordinates,
      fullRoad: road
    });
    
    // Handle different coordinate formats
    let coordinates = road.coordinates || road.road_coordinates || [];
    
    // If coordinates is a string, try to parse it
    if (typeof coordinates === 'string') {
      try {
        coordinates = JSON.parse(coordinates);
      } catch (e) {
        console.warn('Failed to parse coordinates for road:', road.name, coordinates);
        return;
      }
    }
    
    if (!Array.isArray(coordinates)) {
      console.warn('Invalid coordinates for road:', road.name, 'Type:', typeof coordinates, 'Value:', coordinates);
      return;
    }
    
    if (coordinates.length === 0) {
      console.warn('Empty coordinates array for road:', road.name);
      return;
    }

    coordinates.forEach((coord, coordIndex) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        console.warn(`Invalid coord ${coordIndex} for road ${road.name}:`, coord);
        return;
      }
      
      const [roadLat, roadLng] = coord;
      if (!roadLat || !roadLng) {
        console.warn(`Invalid lat/lng for road ${road.name}:`, roadLat, roadLng);
        return;
      }
      
      const distance = calculateDistance(latitude, longitude, roadLat, roadLng);
      console.log(`Distance to ${road.name} coord ${coordIndex}:`, Math.round(distance), 'm');
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = {
          name: road.name || 'Road Point',
          latitude: roadLat,
          longitude: roadLng,
          distance: distance,
          roadId: road.id
        };
      }
    });
  });

  console.log('Nearest road found:', nearestPoint ? `${nearestPoint.name} (${Math.round(nearestPoint.distance)}m)` : 'None found');
  return nearestPoint;
}

// Group road highlights by pickup points
export function groupRoadHighlightsByPickup(roadHighlights, pickupPoints) {
  const grouped = {};
  
  // Color palette for different pickup points
  const colors = ['#2E7D32', '#1976D2', '#F57C00', '#7B1FA2', '#C62828', '#00796B', '#5D4037', '#455A64'];
  let colorIndex = 0;
  
  pickupPoints.forEach(pickup => {
    const associatedRoads = roadHighlights.filter(road => 
      road.pickup_point_id === pickup.id
    );
    
    if (associatedRoads.length > 0) {
      const groupColor = colors[colorIndex % colors.length];
      colorIndex++;
      
      // Apply the group color to all roads in this group
      const coloredRoads = associatedRoads.map(road => ({
        ...road,
        stroke_color: groupColor
      }));
      
      grouped[pickup.id] = {
        pickup: pickup,
        roads: coloredRoads,
        color: groupColor
      };
    }
  });
  
  console.log('Grouped road highlights by pickup:', Object.keys(grouped).length, 'groups');
  return grouped;
}
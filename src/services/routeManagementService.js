import { apiRequest } from './authService';

/**
 * Fetch route summaries with color information
 * @returns {Promise<Array>} Array of route summaries with colors
 */
export async function fetchRouteSummaries() {
  try {
    console.log('[fetchRouteSummaries] Fetching route summaries...');
    
    const result = await apiRequest('/ride-hailing/route-summaries/');
    if (result.success && result.data) {
      const summaries = Array.isArray(result.data) ? result.data : [];
      console.log('[fetchRouteSummaries] Success:', summaries.length, 'summaries');
      return summaries;
    }
    
    console.warn('[fetchRouteSummaries] No route summaries available');
    return [];
  } catch (error) {
    console.error('[fetchRouteSummaries] Error:', error.message);
    return [];
  }
}

/**
 * Get route color by pickup point ID
 * @param {string|number} pickupId - Pickup point ID
 * @param {Array} routeSummaries - Array of route summaries
 * @returns {string} Color hex code
 */
export function getRouteColorByPickup(pickupId, routeSummaries = []) {
  const routeInfo = routeSummaries.find(r => r.pickup_point_id == pickupId);
  return (routeInfo && routeInfo.color) ? routeInfo.color : '#FF0000'; // Default red for pickup points
}

/**
 * Get route color by dropoff point ID
 * @param {string|number} dropoffId - Dropoff point ID
 * @param {Array} routeSummaries - Array of route summaries
 * @returns {string} Color hex code
 */
export function getRouteColorByDropoff(dropoffId, routeSummaries = []) {
  const routeInfo = routeSummaries.find(r => {
    if (r.dropoff_point_ids) {
      let dropoffIds = r.dropoff_point_ids;
      
      if (typeof dropoffIds === 'string') {
        try {
          dropoffIds = dropoffIds.replace(/[{}\"]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } catch (e) {
          dropoffIds = [];
        }
      }
      
      if (Array.isArray(dropoffIds)) {
        return dropoffIds.includes(parseInt(dropoffId));
      }
    }
    return false;
  });
  
  return (routeInfo && routeInfo.color) ? routeInfo.color : '#00AA00'; // Default green for dropoff points
}

/**
 * Get route color by road highlight ID
 * @param {string|number} roadId - Road highlight ID
 * @param {Array} routeSummaries - Array of route summaries
 * @returns {string} Color hex code
 */
export function getRouteColorByRoad(roadId, routeSummaries = []) {
  const routeInfo = routeSummaries.find(r => {
    if (r.road_highlight_ids) {
      let roadIds = r.road_highlight_ids;
      
      if (typeof roadIds === 'string') {
        try {
          roadIds = roadIds.replace(/[{}\"]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        } catch (e) {
          roadIds = [];
        }
      }
      
      if (Array.isArray(roadIds)) {
        return roadIds.includes(parseInt(roadId));
      }
    }
    return false;
  });
  
  return (routeInfo && routeInfo.color) ? routeInfo.color : '#007AFF'; // Default blue for roads
}

/**
 * Process map points with proper colors from route summaries
 * @param {Array} points - Array of map points
 * @param {Array} routeSummaries - Array of route summaries
 * @returns {Array} Processed points with proper colors
 */
export function processMapPointsWithColors(points = [], routeSummaries = []) {
  return points.map(point => {
    let iconColor = '#666666'; // Default gray
    
    // First try to use the point's own color
    if (point.icon_color || point.iconColor) {
      iconColor = point.icon_color || point.iconColor;
    } else {
      // Then check route summaries for associated color
      const routeInfo = routeSummaries.find(r => {
        // Check pickup point
        if (r.pickup_point_id == point.id) {
          return true;
        }
        
        // Check dropoff points
        if (r.dropoff_point_ids) {
          let dropoffIds = r.dropoff_point_ids;
          
          if (typeof dropoffIds === 'string') {
            try {
              dropoffIds = dropoffIds.replace(/[{}\"]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            } catch (e) {
              dropoffIds = [];
            }
          }
          
          if (Array.isArray(dropoffIds)) {
            return dropoffIds.includes(parseInt(point.id));
          }
        }
        return false;
      });
      
      if (routeInfo && routeInfo.color) {
        iconColor = routeInfo.color;
      } else {
        // Set default colors based on point type
        switch (point.point_type || point.pointType) {
          case 'pickup':
            iconColor = '#FF0000'; // Red for pickup
            break;
          case 'dropoff':
            iconColor = '#00AA00'; // Green for dropoff
            break;
          case 'station':
            iconColor = '#0066CC'; // Blue for stations
            break;
          case 'landmark':
            iconColor = '#FF9800'; // Orange for landmarks
            break;
          default:
            iconColor = '#666666'; // Gray for unknown
        }
      }
    }
    
    return {
      latitude: parseFloat(point.latitude || 0),
      longitude: parseFloat(point.longitude || 0),
      title: point.name || 'Unknown Point',
      description: point.description || '',
      pointType: point.point_type || point.pointType || 'unknown',
      iconColor: iconColor,
      image_urls: point.image_urls || [],
      id: point.id || Math.random().toString(),
      isActive: point.is_active !== false,
      routeId: routeInfo ? routeInfo.route_id : null
    };
  });
}

/**
 * Process road highlights with proper colors from route summaries
 * @param {Array} roads - Array of road highlights
 * @param {Array} routeSummaries - Array of route summaries
 * @returns {Array} Processed roads with proper colors
 */
export function processRoadHighlightsWithColors(roads = [], routeSummaries = []) {
  console.log('[processRoadHighlightsWithColors] Processing', roads.length, 'roads with', routeSummaries.length, 'route summaries');
  
  return roads.map(road => {
    // Determine proper color - prioritize road's own color first
    let finalColor = '#FF5722'; // Default red-orange for visibility
    
    if (road.stroke_color || road.color) {
      finalColor = road.stroke_color || road.color;
    } else {
      // Then check route summaries for associated color
      const routeInfo = routeSummaries.find(r => {
        if (r.road_highlight_ids) {
          let roadIds = r.road_highlight_ids;
          
          if (typeof roadIds === 'string') {
            try {
              roadIds = roadIds.replace(/[{}\"]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            } catch (e) {
              roadIds = [];
            }
          }
          
          if (Array.isArray(roadIds)) {
            return roadIds.includes(parseInt(road.id));
          }
        }
        return false;
      });
      
      if (routeInfo && routeInfo.color) {
        finalColor = routeInfo.color;
      } else {
        // Set color based on highlight type
        switch (road.highlight_type || road.type) {
          case 'main_route':
            finalColor = '#FF5722'; // Red-orange for main routes
            break;
          case 'alternative':
            finalColor = '#2196F3'; // Blue for alternatives
            break;
          case 'available':
            finalColor = '#4CAF50'; // Green for available
            break;
          default:
            finalColor = '#FF5722'; // Default red-orange
        }
      }
    }
    
    // Process coordinates properly
    let coordinates = null;
    if (road.road_coordinates && Array.isArray(road.road_coordinates)) {
      coordinates = road.road_coordinates;
    } else if (road.coordinates && Array.isArray(road.coordinates)) {
      coordinates = road.coordinates;
    }
    
    return {
      id: road.id || Math.random().toString(),
      name: road.name || 'Road Highlight',
      road_coordinates: coordinates,
      coordinates: coordinates, // Also set coordinates for LeafletMapView
      start_latitude: road.start_latitude,
      start_longitude: road.start_longitude,
      end_latitude: road.end_latitude,
      end_longitude: road.end_longitude,
      stroke_color: finalColor,
      color: finalColor, // Also set color for LeafletMapView
      stroke_width: road.stroke_width || road.weight || 4,
      weight: road.stroke_width || road.weight || 4, // Also set weight for LeafletMapView
      stroke_opacity: road.stroke_opacity || road.opacity || 0.8,
      opacity: road.stroke_opacity || road.opacity || 0.8, // Also set opacity for LeafletMapView
      highlight_type: road.highlight_type || road.type || 'available'
    };
  });
}

/**
 * Build route summaries from pickup points by fetching individual route data
 * @param {Array} pickupPoints - Array of pickup points
 * @returns {Promise<Array>} Built route summaries
 */
export async function buildRouteSummariesFromPickups(pickupPoints = []) {
  const routeSummaries = [];
  
  console.log('[buildRouteSummariesFromPickups] Processing', pickupPoints.length, 'pickup points');
  
  for (const point of pickupPoints) {
    if (point.pointType === 'pickup' || point.point_type === 'pickup') {
      try {
        // Import the function dynamically to avoid circular dependency
        const { getRoutesByPickup } = await import('./rideHailingService');
        const routeResult = await getRoutesByPickup(point.id);
        
        console.log(`Route data for pickup ${point.id}:`, routeResult);
        
        if (routeResult.success && routeResult.data) {
          const { available_destinations = [], road_highlights = [], color } = routeResult.data;
          
          console.log(`Pickup ${point.id} - Color: ${color}, Destinations: ${available_destinations.length}, Roads: ${road_highlights.length}`);
          
          if (color) {
            routeSummaries.push({
              pickup_point_id: point.id,
              color: color,
              dropoff_point_ids: available_destinations.map(dest => dest.id),
              road_highlight_ids: road_highlights.map(road => road.id),
              route_id: `route_${point.id}`
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to get route data for pickup ${point.id}:`, error.message);
      }
    }
  }
  
  console.log('[buildRouteSummariesFromPickups] Built', routeSummaries.length, 'route summaries:', routeSummaries);
  return routeSummaries;
}

/**
 * Get all routes with their associated points and road highlights
 * @returns {Promise<Object>} Routes data with colors
 */
export async function getAllRoutesWithColors() {
  try {
    console.log('[getAllRoutesWithColors] Fetching all routes...');
    
    const result = await apiRequest('/ride-hailing/routes/');
    
    if (result.success && result.data) {
      const routes = result.data.data || result.data || [];
      console.log('[getAllRoutesWithColors] Success:', routes.length, 'routes');
      return {
        success: true,
        data: routes
      };
    }
    
    return {
      success: false,
      data: [],
      error: 'No routes data received'
    };
  } catch (error) {
    console.error('[getAllRoutesWithColors] Error:', error.message);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}
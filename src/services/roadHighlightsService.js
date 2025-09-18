import { apiBaseUrl } from './networkConfig';

const API_BASE_URL = apiBaseUrl();

export async function getRoadHighlights() {
  try {
    const response = await fetch(`${API_BASE_URL}/map/road-highlights/`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      return result.data.roads || [];
    } else {
      throw new Error(result.error || 'Failed to fetch road highlights');
    }
  } catch (error) {
    console.error('Error fetching road highlights:', error);
    throw error;
  }
}

// Calculate distance between two points
export function calculateDistance(lat1, lon1, lat2, lon2) {
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
export function findNearestRoadPoint(roads, latitude, longitude, maxDistance = 100) {
  let nearestPoint = null;
  let minDistance = maxDistance;

  roads.forEach(road => {
    if (!road.coordinates || !Array.isArray(road.coordinates)) return;

    road.coordinates.forEach(coord => {
      if (!Array.isArray(coord) || coord.length < 2) return;
      
      const [roadLat, roadLng] = coord;
      const distance = calculateDistance(latitude, longitude, roadLat, roadLng);
      
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

  return nearestPoint;
}
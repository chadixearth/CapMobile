# Map API Usage Documentation

## Overview
This document provides comprehensive information on how to use the map API endpoints from the mobile application. The map system supports displaying points of interest, road highlights, routes, and zones on an interactive map.

## Base URL
The API base URL is configured in your `networkConfig.js` file and typically follows this pattern:
- Development: `http://localhost:8000/api`
- Production: `https://your-domain.com/api`

## Available Endpoints

### 1. Get All Map Data
**Endpoint:** `GET /map/data/`

**Description:** Fetches comprehensive map data including all points, roads, routes, zones, and configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "points": [
      {
        "id": "point-1",
        "name": "Terminal 1",
        "description": "Main pickup terminal",
        "latitude": 10.3157,
        "longitude": 123.8854,
        "point_type": "pickup",
        "icon_color": "#FF0000",
        "is_active": true
      }
    ],
    "roads": [
      {
        "id": "road-1",
        "name": "Main Route",
        "color": "#007AFF",
        "weight": 4,
        "opacity": 0.7,
        "coordinates": [{"lat": 10.3157, "lng": 123.8854}],
        "start_latitude": 10.3157,
        "start_longitude": 123.8854,
        "end_latitude": 10.3257,
        "end_longitude": 123.8954
      }
    ],
    "routes": [],
    "zones": [],
    "config": {
      "center_latitude": 10.3157,
      "center_longitude": 123.8854,
      "zoom_level": 13,
      "map_style": "standard"
    },
    "total_items": {
      "points": 1,
      "roads": 1,
      "routes": 0,
      "zones": 0
    }
  },
  "message": "Map data fetched successfully"
}
```

**Usage in Mobile App:**
```javascript
import { fetchMapData } from './services/map/fetchMap';

// In your component
const loadMap = async () => {
  try {
    const mapData = await fetchMapData();
    console.log('Map data loaded:', mapData);
    // Process and display the data
  } catch (error) {
    console.error('Failed to load map:', error);
  }
};
```

### 2. Get Terminal Points
**Endpoint:** `GET /map/terminals/`

**Query Parameters:**
- `type` (optional): Filter by point type (`pickup`, `station`, `landmark`, `terminal`)
- `active` (optional): Filter by active status (`true`/`false`)

**Description:** Fetches only terminal and pickup points, useful for destination selection.

**Response:**
```json
{
  "success": true,
  "data": {
    "terminals": [...],
    "grouped": {
      "pickup": [...],
      "station": [...],
      "landmark": [...]
    },
    "total": 10
  },
  "message": "Fetched 10 terminal points"
}
```

**Usage in Mobile App:**
```javascript
import { fetchTerminals } from './services/map/fetchMap';

// Get all active terminals
const terminals = await fetchTerminals({ active: true });

// Get only pickup points
const pickupPoints = await fetchTerminals({ type: 'pickup' });
```

### 3. Get Routes
**Endpoint:** `GET /map/routes/`

**Query Parameters:**
- `active` (optional): Filter by active status
- `type` (optional): Filter by route type

**Description:** Fetches tartanilla routes for navigation display.

**Usage in Mobile App:**
```javascript
import { fetchRoutes } from './services/map/fetchMap';

const routes = await fetchRoutes({ active: true });
```

### 4. Add Map Point
**Endpoint:** `POST /map/points/`

**Request Body:**
```json
{
  "name": "New Terminal",
  "description": "Description of the point",
  "latitude": 10.3157,
  "longitude": 123.8854,
  "point_type": "pickup",
  "icon_color": "#FF0000"
}
```

**Usage in Mobile App:**
```javascript
import { addMapPoint } from './services/map/fetchMap';

const newPoint = await addMapPoint({
  name: "New Pickup Point",
  description: "Located near the market",
  latitude: 10.3157,
  longitude: 123.8854,
  point_type: "pickup",
  icon_color: "#FF0000"
});
```

### 5. Add Road Highlight
**Endpoint:** `POST /map/roads/`

**Request Body (Option 1 - with coordinates array):**
```json
{
  "name": "Route A",
  "description": "Main route through downtown",
  "coordinates": [
    {"lat": 10.3157, "lng": 123.8854},
    {"lat": 10.3167, "lng": 123.8864},
    {"lat": 10.3177, "lng": 123.8874}
  ],
  "color": "#007AFF",
  "weight": 4,
  "opacity": 0.7
}
```

**Request Body (Option 2 - with start/end points):**
```json
{
  "name": "Route B",
  "description": "Direct route",
  "start_latitude": 10.3157,
  "start_longitude": 123.8854,
  "end_latitude": 10.3257,
  "end_longitude": 123.8954,
  "color": "#00AA00",
  "weight": 3,
  "opacity": 0.8
}
```

**Usage in Mobile App:**
```javascript
import { addRoadHighlight } from './services/map/fetchMap';

const newRoad = await addRoadHighlight({
  name: "Tourist Route",
  coordinates: routeCoordinates,
  color: "#FF00FF",
  weight: 5,
  opacity: 0.6
});
```

### 6. Update Map Point
**Endpoint:** `PUT /map/points/{point_id}/`

**Request Body:** (include only fields to update)
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": false
}
```

**Usage in Mobile App:**
```javascript
import { updateMapPoint } from './services/map/fetchMap';

await updateMapPoint('point-123', {
  name: "Terminal 1 - Updated",
  is_active: true
});
```

### 7. Delete Map Point
**Endpoint:** `DELETE /map/points/{point_id}/delete/`

**Usage in Mobile App:**
```javascript
import { deleteMapPoint } from './services/map/fetchMap';

const success = await deleteMapPoint('point-123');
if (success) {
  console.log('Point deleted successfully');
}
```

## Map Component Integration

### Basic Map Display
```javascript
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import LeafletMap from './components/LeafletMap';
import { fetchMapData } from './services/map/fetchMap';

const MapScreen = () => {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async () => {
    try {
      const data = await fetchMapData();
      setMapData(data);
    } catch (error) {
      console.error('Map loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <LeafletMap
      region={{
        latitude: mapData.config.center_latitude,
        longitude: mapData.config.center_longitude,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15
      }}
      markers={mapData.points}
      roads={mapData.roads}
      routes={mapData.routes}
      zones={mapData.zones}
    />
  );
};
```

## Point Types

The following point types are supported:
- `pickup` - Tartanilla pickup points (red markers)
- `station` - Transit stations (green markers)
- `landmark` - Notable landmarks (blue markers)
- `terminal` - Terminal stations (purple markers)

## Road/Route Styling

Roads and routes support the following styling options:
- `color`: Hex color code (e.g., "#007AFF")
- `weight`: Line thickness (1-10)
- `opacity`: Transparency (0.0-1.0)

## Error Handling

All API functions include error handling. Always wrap API calls in try-catch blocks:

```javascript
try {
  const data = await fetchMapData();
  // Process data
} catch (error) {
  // Handle error appropriately
  Alert.alert('Error', 'Failed to load map data');
}
```

## Best Practices

1. **Cache Map Data**: Store map data locally to reduce API calls
2. **Lazy Loading**: Load detailed data only when needed
3. **Error Recovery**: Provide fallback options when API fails
4. **Optimize Coordinates**: Reduce coordinate precision to save bandwidth
5. **Batch Updates**: Group multiple map updates into single requests when possible

## Testing

To test the map functionality:

1. **Check API Connection:**
```javascript
// Test if API is reachable
const testConnection = async () => {
  try {
    const data = await fetchMapData();
    console.log('API Connection Success:', data.total_items);
  } catch (error) {
    console.error('API Connection Failed:', error);
  }
};
```

2. **Add Test Points:**
```javascript
// Add test markers to the map
const addTestMarkers = async () => {
  const testPoints = [
    { name: "Test 1", latitude: 10.3157, longitude: 123.8854, point_type: "pickup" },
    { name: "Test 2", latitude: 10.3167, longitude: 123.8864, point_type: "station" }
  ];
  
  for (const point of testPoints) {
    await addMapPoint(point);
  }
};
```

## Troubleshooting

### Common Issues and Solutions:

1. **Map not loading:**
   - Check API base URL configuration
   - Verify network connectivity
   - Check console for error messages

2. **Points not displaying:**
   - Ensure coordinates are valid numbers
   - Check point_type is recognized
   - Verify is_active status

3. **Roads not rendering:**
   - Validate coordinate format
   - Check color and opacity values
   - Ensure coordinates array is not empty

4. **API timeout errors:**
   - Increase timeout duration in apiCall function
   - Check server performance
   - Reduce data payload size

## Support

For additional support or to report issues:
- Check the console logs for detailed error messages
- Review the API response structure
- Ensure all required fields are provided in requests

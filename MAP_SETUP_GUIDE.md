# Map Setup Guide

## MapViewScreen Changes

The MapViewScreen has been cleaned up to be a pure map view component:

### Removed Features:
- ❌ "My Rides" toggle and functionality
- ❌ Ride status cards and ride management
- ❌ Toggle between map view and rides view

### Current Features:
- ✅ Pure map display with markers and roads
- ✅ Driver location tracking
- ✅ Map data fetching from backend
- ✅ Pickup/dropoff point selection
- ✅ Route visualization
- ✅ Map controls (satellite, legend, refresh)

## Backend API Verification

### 1. Check Network Configuration

Update the IP address in `src/services/networkConfig.js`:

```javascript
export const API_HOST_OVERRIDE = 'YOUR_COMPUTER_IP_HERE'; // e.g., '192.168.1.100'
```

To find your IP address:
- **Windows**: Run `ipconfig` in Command Prompt
- **Mac/Linux**: Run `ifconfig` or `ip addr show`
- Look for your local network IP (usually starts with 192.168.x.x or 10.x.x.x)

### 2. Verify Backend is Running

Make sure your Django backend is running on port 8000:
```bash
cd /path/to/Capstone-Web/CapstoneWeb
python manage.py runserver 0.0.0.0:8000
```

### 3. Test Map Data API

The backend should respond to: `http://YOUR_IP:8000/api/map/data/`

Expected response structure:
```json
{
  "success": true,
  "data": {
    "points": [...],
    "roads": [...],
    "routes": [...],
    "zones": [...],
    "config": {
      "center_latitude": 10.3157,
      "center_longitude": 123.8854,
      "zoom_level": 13
    },
    "total_items": {
      "points": 0,
      "roads": 0,
      "routes": 0,
      "zones": 0
    }
  }
}
```

### 4. Use Map Data Test Component

Add the test component to your app to debug API connectivity:

```javascript
import MapDataTest from './src/components/MapDataTest';

// Add to your navigation or render it temporarily
<MapDataTest />
```

This will help you:
- Test basic network connectivity
- Verify API endpoint responses
- Debug JSON parsing issues
- Check data structure

## Common Issues & Solutions

### Issue: "Cannot connect to server"
**Solution**: 
1. Verify your IP address in `networkConfig.js`
2. Make sure backend is running with `0.0.0.0:8000`
3. Check firewall settings
4. Ensure mobile device is on same network

### Issue: "Empty response from server"
**Solution**:
1. Check Django server logs for errors
2. Verify the `/api/map/data/` endpoint exists
3. Check CORS settings in Django

### Issue: "No map data displayed"
**Solution**:
1. Check if backend database has map points
2. Verify API response structure matches expected format
3. Check browser/app console for JavaScript errors

### Issue: "JSON parse error"
**Solution**:
1. Check Django response format
2. Look for truncated responses
3. Verify Content-Type headers

## Database Setup

Make sure your backend has data in these tables:
- `map_points` - For pickup/dropoff locations
- `road_highlights` - For route visualization
- `route_summary` - For route management

If tables are empty, the app will show default fallback locations in Cebu City.

## Testing Steps

1. **Start Backend**: `python manage.py runserver 0.0.0.0:8000`
2. **Update IP**: Set correct IP in `networkConfig.js`
3. **Test API**: Use MapDataTest component or browser
4. **Check Logs**: Monitor both Django and React Native logs
5. **Verify Data**: Ensure map displays points and roads

## Default Fallback Data

If the backend is unavailable, the app will show these default locations:
- SM City Cebu Terminal (10.3157, 123.8854)
- Ayala Center Cebu Terminal (10.3187, 123.9064)  
- Plaza Independencia (10.2934, 123.9015)

This ensures the map always has some content to display.
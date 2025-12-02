# Ride Completion Popup & Driver History Fix

## Issues
1. ✅ Ride completion popup not showing automatically
2. ✅ Driver ride hailing history not showing

## Root Causes

### Issue 1: Popup Not Showing
- The `activeRides` state was empty on first poll, so comparison didn't work
- Need to check both `in_progress` AND `driver_assigned` status

### Issue 2: Driver History Not Showing  
- Backend endpoint exists: `/api/ride-hailing/driver-history/?driver_id=X`
- Mobile app (BookingHistoryScreen) only fetches from `/api/tour-booking/` and `/api/ride-hailing/`
- The `/api/ride-hailing/` endpoint returns ALL rides, not filtered by driver
- Need to use the specific driver-history endpoint

## Solutions Applied

### Fix 1: Completion Detection (TerminalsScreen.js)
```javascript
// Check if any rides changed to completed
if (activeRides.length > 0) {
  activeRides.forEach(oldRide => {
    const stillActive = newActiveRides.find(r => r.id === oldRide.id);
    // Check BOTH in_progress AND driver_assigned
    if (!stillActive && (oldRide.status === 'in_progress' || oldRide.status === 'driver_assigned')) {
      console.log('[TerminalsScreen] Ride completed detected:', oldRide.id);
      handleRideRefresh({ ...oldRide, status: 'completed' });
    }
  });
}
```

### Fix 2: Driver History (Backend Already Has It)
The backend already has the endpoint at line ~1100 in ride_hailing.py:
```python
@action(detail=False, methods=['get'], url_path='driver-history')
def driver_history(self, request):
    driver_id = request.query_params.get('driver_id')
    resp = supabase.table(self.TABLE).select('*').eq('driver_id', driver_id).in_('status', ['completed', 'cancelled']).order('completed_at', desc=True).limit(50).execute()
    rides = getattr(resp, 'data', [])
    enriched = self._enrich_rides_with_details(rides)
    return Response({'success': True, 'data': enriched, 'count': len(enriched)})
```

**Mobile app needs to call:**
- Tourist: `/api/ride-hailing/customer-history/?customer_id=X`
- Driver: `/api/ride-hailing/driver-history/?driver_id=X`

## Testing

### Test Completion Popup:
1. Tourist books ride
2. Driver accepts
3. Driver starts ride
4. Driver completes ride
5. **Within 5 seconds:**
   - Alert appears: "Ride Completed! 🎉"
   - Tourist clicks OK
   - Review modal opens
   - Ride moves to History tab

### Test Driver History:
1. Driver completes a ride hailing booking
2. Navigate to driver's booking history
3. Ride should appear in history
4. Should show:
   - Pickup/dropoff addresses
   - Fare amount
   - Completion date
   - Status: "Completed"

## Files Modified
1. `src/screens/map/TerminalsScreen.js` - Fixed completion detection

## Files That Need Update (For Driver History)
1. `src/screens/main/BookingHistoryScreen.js` - Add driver role check and use driver-history endpoint
2. OR create separate `DriverBookingHistoryScreen.js` for drivers

## Next Steps

### For Driver History:
Update BookingHistoryScreen.js to check user role and fetch accordingly:

```javascript
// In fetchBookings function
if (user?.role === 'driver' || user?.role === 'driver-owner') {
  // Fetch driver history
  const [tourResponse, rideResponse] = await Promise.all([
    fetch(`${apiBaseUrl()}/tour-booking/`, {
      headers: { 'Authorization': `Bearer ${await getAccessToken()}` },
    }),
    fetch(`${apiBaseUrl()}/ride-hailing/driver-history/?driver_id=${user.id}`, {
      headers: { 'Authorization': `Bearer ${await getAccessToken()}` },
    })
  ]);
} else {
  // Fetch customer history (existing code)
  const [tourResponse, rideResponse] = await Promise.all([
    fetch(`${apiBaseUrl()}/tour-booking/`, {
      headers: { 'Authorization': `Bearer ${await getAccessToken()}` },
    }),
    fetch(`${apiBaseUrl()}/ride-hailing/customer-history/?customer_id=${user.id}`, {
      headers: { 'Authorization': `Bearer ${await getAccessToken()}` },
    })
  ]);
}
```

## Status
- ✅ Completion popup: FIXED
- ⚠️ Driver history: Backend ready, mobile needs update

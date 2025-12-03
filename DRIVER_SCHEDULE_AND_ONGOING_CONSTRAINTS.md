# Driver Schedule and Ongoing Booking Constraints

## Overview
Implemented comprehensive validation to ensure drivers can only accept bookings when they have scheduled availability and no ongoing bookings.

## Constraints Implemented

### 1. ✅ Same-Day Booking Check
**Rule**: Driver can accept multiple bookings on the same day ONLY if:
- Same package AND
- No time conflict

**Cannot accept if**:
- Different package on same day OR
- Same package but time overlaps

**Implementation**:
- Location: `acceptBooking.js` - `checkOngoingBookings()` function
- Checks bookings on same date with status: `in_progress`, `driver_assigned`, or `paid`
- Integrates with `driverBookingConstraints.js` for time conflict detection
- Runs AFTER schedule check, BEFORE carriage eligibility check

**Error Codes**: 
- `DIFFERENT_PACKAGE_SAME_DAY` - Different package on same day
- `TIME_CONFLICT_SAME_PACKAGE` - Same package but time overlaps

**User Experience**:
```
Different Package:
Alert: "📦 Different Package"
Message: "You already have a booking for [Package Name] on this day. Only same package allowed."
Actions: [OK, View Ongoing]

Time Conflict:
Alert: "⏰ Time Conflict"
Message: "This booking overlaps with your existing booking at [Time]."
Actions: [OK, View Schedule]
```

### 2. ✅ Driver Schedule Availability Check
**Rule**: Driver cannot accept a booking if they haven't scheduled availability for that date/time.

**Implementation**:
- Location: `acceptBooking.js` - `checkDriverSchedule()` function
- Integrates with `driverScheduleService.checkAvailability()`
- Validates against driver's schedule in `driver_schedule` table
- Checks for:
  - Driver marked as unavailable for the entire day
  - Specific time slots marked as unavailable
  - Existing bookings at the same time in `driver_calendar`

**Error Code**: `SCHEDULE_CONFLICT`

**User Experience**:
```
Alert: "📅 Schedule Conflict"
Message: "You are not available at this time. Please update your schedule."
Actions: [OK, Update Schedule]
```

### 3. ✅ Carriage Eligibility Check (Already Implemented)
**Rule**: Driver must have an eligible tartanilla carriage assigned.

**Error Code**: `NO_ELIGIBLE_CARRIAGE`, `CARRIAGE_SUSPENDED`, etc.

## Validation Flow

When driver attempts to accept a booking:

```
1. Check Driver Schedule
   ├─ Not available? → ❌ Reject with SCHEDULE_CONFLICT
   └─ Available? → Continue to step 2

2. Check Same-Day Bookings
   ├─ Different package same day? → ❌ Reject with DIFFERENT_PACKAGE_SAME_DAY
   ├─ Same package but time conflict? → ❌ Reject with TIME_CONFLICT_SAME_PACKAGE
   └─ No conflict? → Continue to step 3

3. Check Carriage Eligibility
   ├─ No eligible carriage? → ❌ Reject with NO_ELIGIBLE_CARRIAGE
   └─ Has eligible carriage? → ✅ Accept booking
```

## Backend Integration

### Driver Schedule API
The mobile app integrates with the backend driver schedule API:

**Endpoint**: `/api/driver-schedule/check-availability/`

**Request**:
```json
{
  "driver_id": "uuid",
  "booking_date": "2024-01-15",
  "booking_time": "09:00"
}
```

**Response**:
```json
{
  "success": true,
  "available": false,
  "conflict_reason": "Driver is not available on 2024-01-15",
  "driver_id": "uuid",
  "booking_date": "2024-01-15",
  "booking_time": "09:00"
}
```

### Schedule Conflict Detection
The backend checks:
1. **Driver Calendar**: Existing confirmed bookings at the same time
2. **Driver Schedule**: Explicit availability settings
   - `is_available = false` → Unavailable for entire day
   - `unavailable_times` array → Specific time slots unavailable
   - No schedule entry → Available by default (permissive)

## Error Handling

### Graceful Degradation
If schedule check fails due to network/API issues:
- **Behavior**: Allow booking to proceed
- **Reason**: Prevent blocking drivers due to technical issues
- **Logging**: Error logged for debugging

### Error Codes
- `DIFFERENT_PACKAGE_SAME_DAY` - Different package on same day
- `TIME_CONFLICT_SAME_PACKAGE` - Same package but time overlaps
- `SCHEDULE_CONFLICT` - Not available at requested time
- `NO_ELIGIBLE_CARRIAGE` - No carriage assigned
- `CARRIAGE_SUSPENDED` - Carriage is suspended
- `CARRIAGE_NOT_AVAILABLE` - Carriage status not available

## User Actions

### When Different Package Detected
- **View Ongoing**: Navigate to "Ongoing" tab to see current booking
- **OK**: Dismiss alert

### When Time Conflict Detected
- **View Schedule**: Open schedule modal to see bookings
- **OK**: Dismiss alert

### When Schedule Conflict Detected
- **Update Schedule**: Open schedule modal to set availability
- **OK**: Dismiss alert

### When Carriage Issue Detected
- **Contact Admin**: Navigate to chat to contact admin
- **OK**: Dismiss alert

## Testing Scenarios

### Test Case 1: Accept Different Package Same Day
**Given**: Driver has booking for Package A on Jan 15
**When**: Driver attempts to accept Package B on Jan 15
**Then**: Show "Different Package" error with option to view ongoing

### Test Case 2: Accept Without Schedule
**Given**: Driver has no schedule entry for booking date
**When**: Driver attempts to accept booking
**Then**: ✅ Allow (permissive approach - available by default)

### Test Case 3: Accept When Unavailable
**Given**: Driver set `is_available = false` for booking date
**When**: Driver attempts to accept booking
**Then**: Show "Schedule Conflict" error with option to update schedule

### Test Case 4: Accept at Unavailable Time
**Given**: Driver has specific time in `unavailable_times` array
**When**: Driver attempts to accept booking at that time
**Then**: Show "Schedule Conflict" error

### Test Case 5: Accept with Available Schedule
**Given**: Driver has `is_available = true` and time not in `unavailable_times`
**When**: Driver attempts to accept booking
**Then**: ✅ Proceed to carriage eligibility check

### Test Case 6: Accept with No Carriage
**Given**: Driver passes schedule checks but has no carriage
**When**: Driver attempts to accept booking
**Then**: Show "Carriage Required" error

## Files Modified

1. ✅ `src/services/tourpackage/acceptBooking.js`
   - Added `checkOngoingBookings()` function
   - Added `checkDriverSchedule()` function
   - Updated `driverAcceptBooking()` to accept `bookingDetails` parameter
   - Added validation flow before carriage check

2. ✅ `src/screens/main/DriverBookScreen.js`
   - Updated `confirmAcceptBooking()` to pass booking details
   - Added error handling for `DRIVER_HAS_ONGOING_BOOKING`
   - Added error handling for `SCHEDULE_CONFLICT`
   - Added navigation to schedule modal on conflict

## Benefits

1. **Prevents Double Booking**: Drivers can't accept multiple bookings simultaneously
2. **Respects Driver Availability**: Only shows bookings when driver is available
3. **Clear Communication**: Friendly error messages explain why booking can't be accepted
4. **Actionable Guidance**: Provides next steps (view ongoing, update schedule)
5. **Graceful Degradation**: Doesn't block bookings if validation fails
6. **Backend Consistency**: Matches backend validation logic

## Related Documentation

- `DRIVER_BOOKING_CONSTRAINTS.md` - One booking per day constraint
- `CARRIAGE_ELIGIBILITY_CONSTRAINTS.md` - Carriage eligibility requirements
- Backend: `api/driver_schedule.py` - Schedule management API

---

**Implementation Date**: 2024
**Status**: ✅ Complete and Tested
**Backend Integration**: ✅ Verified with `/api/driver-schedule/check-availability/`

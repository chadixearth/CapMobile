# Driver Booking Constraints Implementation

## Overview
Implemented constraint validation to ensure drivers can only accept 1 booking per day, with an exception for the same tour package (if no time conflicts exist).

## Constraint Rules

### 1. One Booking Per Day (Default)
- A driver can only accept **one booking per day**
- This prevents drivers from being overbooked
- Applies to all tour package bookings

### 2. Same Package Exception
- **Exception**: Driver can accept multiple bookings for the **same tour package** on the same day
- This allows drivers to run multiple tours of the same package if they have capacity

### 3. Time Conflict Prevention
- Even for the same package, bookings **cannot overlap in time**
- System checks start time + duration to detect conflicts
- Prevents double-booking at the same time slot

## Implementation Details

### New Service: `driverBookingConstraints.js`

Located at: `src/services/tourpackage/driverBookingConstraints.js`

#### Key Functions:

1. **`validateDriverBookingConstraints(driverId, newBooking)`**
   - Validates if driver can accept a new booking
   - Checks for existing bookings on the same date
   - Returns validation result with detailed error messages

2. **`checkTimeConflict(time1, duration1, time2, duration2)`**
   - Compares two time slots to detect overlaps
   - Calculates overlap duration in minutes
   - Returns conflict details if found

3. **`getDriverBookingsSummary(driverId, date)`**
   - Gets summary of driver's bookings for a specific date
   - Returns active bookings and package list

### Integration Points

#### 1. Accept Booking Service (`acceptBooking.js`)
- Added import: `validateDriverBookingConstraints`
- Modified `driverAcceptBooking()` to accept `bookingDetails` parameter
- Validation runs before carriage eligibility check
- Returns structured error response if constraints violated

#### 2. Driver Book Screen (`DriverBookScreen.js`)
- Updated `confirmAcceptBooking()` to pass booking details:
  - `booking_date`
  - `booking_time` (pickup_time)
  - `package_id`
  - `package_name`
  - `duration`
- Added error handling for new error codes:
  - `DIFFERENT_PACKAGE_SAME_DAY`
  - `TIME_CONFLICT_SAME_PACKAGE`

## Error Codes

### `DIFFERENT_PACKAGE_SAME_DAY`
**Trigger**: Driver tries to accept a booking for a different package on a day they already have a booking

**Message**: "You already have a booking for [Package Name] on [Date]. You can only accept one booking per day unless it's the same tour package."

**User Action**: Driver must complete or cancel existing booking before accepting a different package

### `TIME_CONFLICT_SAME_PACKAGE`
**Trigger**: Driver tries to accept a booking for the same package but the time overlaps with an existing booking

**Message**: "Time conflict detected! You already have a booking for [Package Name] at [Time] on [Date]. The new booking at [Time] would overlap."

**User Action**: Driver should choose a different time slot or complete the existing booking first

## Example Scenarios

### ✅ Allowed: Same Package, No Conflict
- **Existing**: Package A, 9:00 AM - 11:00 AM
- **New**: Package A, 2:00 PM - 4:00 PM
- **Result**: ✅ Accepted (same package, different times)

### ❌ Blocked: Different Package, Same Day
- **Existing**: Package A, 9:00 AM - 11:00 AM
- **New**: Package B, 2:00 PM - 4:00 PM
- **Result**: ❌ Rejected (different package, same day)

### ❌ Blocked: Same Package, Time Conflict
- **Existing**: Package A, 9:00 AM - 11:00 AM
- **New**: Package A, 10:00 AM - 12:00 PM
- **Result**: ❌ Rejected (time overlap detected)

### ✅ Allowed: Same Package, Adjacent Times
- **Existing**: Package A, 9:00 AM - 11:00 AM
- **New**: Package A, 11:00 AM - 1:00 PM
- **Result**: ✅ Accepted (no overlap, back-to-back allowed)

## Time Conflict Detection

### Algorithm
1. Convert time strings (HH:MM) to minutes since midnight
2. Calculate end time = start time + duration
3. Check if ranges overlap: `(start1 < end2) AND (end1 > start2)`
4. If overlap exists, calculate overlap duration

### Example Calculation
```
Booking 1: 9:00 AM (540 min) + 120 min duration = 11:00 AM (660 min)
Booking 2: 10:00 AM (600 min) + 90 min duration = 11:30 AM (690 min)

Overlap check: (540 < 690) AND (660 > 600) = TRUE
Overlap duration: min(660, 690) - max(540, 600) = 660 - 600 = 60 minutes
```

## User Experience

### Driver Perspective
1. **Viewing Available Bookings**: All bookings are visible
2. **Attempting to Accept**: Validation runs automatically
3. **Constraint Violation**: Clear error message explains why booking cannot be accepted
4. **Successful Accept**: Booking is assigned to driver

### Error Messages
- **User-friendly**: Explains the constraint in simple terms
- **Actionable**: Tells driver what they need to do
- **Informative**: Shows conflicting booking details

## Testing Scenarios

### Test Case 1: First Booking of the Day
- **Setup**: Driver has no bookings for the date
- **Action**: Accept any booking
- **Expected**: ✅ Success

### Test Case 2: Second Booking, Different Package
- **Setup**: Driver has Package A at 9:00 AM
- **Action**: Accept Package B at 2:00 PM
- **Expected**: ❌ Error: DIFFERENT_PACKAGE_SAME_DAY

### Test Case 3: Second Booking, Same Package, No Conflict
- **Setup**: Driver has Package A at 9:00 AM - 11:00 AM
- **Action**: Accept Package A at 2:00 PM - 4:00 PM
- **Expected**: ✅ Success

### Test Case 4: Second Booking, Same Package, Time Conflict
- **Setup**: Driver has Package A at 9:00 AM - 11:00 AM
- **Action**: Accept Package A at 10:00 AM - 12:00 PM
- **Expected**: ❌ Error: TIME_CONFLICT_SAME_PACKAGE

### Test Case 5: Adjacent Bookings
- **Setup**: Driver has Package A at 9:00 AM - 11:00 AM
- **Action**: Accept Package A at 11:00 AM - 1:00 PM
- **Expected**: ✅ Success (no overlap)

## Benefits

1. **Prevents Overbooking**: Drivers can't accidentally accept conflicting bookings
2. **Flexible for Popular Packages**: Allows multiple runs of the same tour
3. **Time Safety**: Ensures adequate time between bookings
4. **Clear Communication**: Drivers understand why they can't accept certain bookings
5. **Business Logic Enforcement**: Maintains operational integrity

## Future Enhancements

1. **Buffer Time**: Add configurable buffer between bookings (e.g., 30 minutes)
2. **Admin Override**: Allow admins to bypass constraints in special cases
3. **Package Duration**: Fetch actual package duration from database
4. **Calendar View**: Show driver's schedule visually with conflicts highlighted
5. **Notification**: Alert driver when conflicting booking is cancelled

## Files Modified

1. ✅ `src/services/tourpackage/driverBookingConstraints.js` (NEW)
2. ✅ `src/services/tourpackage/acceptBooking.js` (MODIFIED)
3. ✅ `src/screens/main/DriverBookScreen.js` (MODIFIED)

## Deployment Notes

- No database changes required
- Backward compatible with existing bookings
- Client-side validation with server-side enforcement recommended
- Consider adding backend validation for security

---

**Implementation Date**: 2024
**Status**: ✅ Complete and Ready for Testing

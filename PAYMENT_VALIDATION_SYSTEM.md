# Payment Validation System for Tour Bookings

## Overview
The payment validation system ensures that drivers can only start tour bookings (both admin-created and driver-created packages) after tourists have completed payment. This protects drivers from unpaid trips and ensures proper revenue collection.

## How It Works

### 1. Booking Flow
```
Tourist Books Package → Driver Accepts → Tourist Pays → Driver Can Start Trip
```

### 2. Payment Status States
- **`pending`**: Tourist has not paid yet - Driver CANNOT start trip
- **`paid`**: Tourist has completed payment - Driver CAN start trip

### 3. Backend Validation
Located in: `src/services/tourpackage/acceptBooking.js`

The `driverStartBooking()` function validates payment status:
```javascript
// Backend checks payment status before allowing trip to start
if (booking.payment_status !== 'paid') {
  return {
    success: false,
    error_code: 'PAYMENT_REQUIRED',
    friendly_message: 'This booking cannot be started until the customer completes payment.'
  };
}
```

### 4. Frontend UI Indicators

#### Payment Status Display (in Earnings Section)
- **Paid**: ✓ Paid - Ready to Start (Green)
- **Pending**: ⏳ Pending - Cannot Start Yet (Orange)

#### Start Trip Button States
- **Payment Paid + Correct Date**: Blue "Start Trip" button (enabled)
- **Payment Paid + Future Date**: Gray button showing "Starts on [date]" (disabled)
- **Payment Pending**: Gray button showing "⏳ Waiting for Tourist Payment" (disabled)

### 5. Error Handling
When driver tries to start unpaid booking:
```javascript
CustomAlert.warning(
  'Payment Required',
  'This booking cannot be started until the customer completes payment. 
   Please wait for payment confirmation.'
);
```

## User Experience

### For Drivers
1. **Accept Booking**: Driver accepts a tourist's booking request
2. **Wait for Payment**: Driver sees "⏳ Waiting for Tourist Payment" button
3. **Payment Notification**: Driver receives notification when tourist pays
4. **Start Trip**: "Start Trip" button becomes enabled (blue)
5. **Complete Trip**: Driver completes the trip and earns 80% of fare

### For Tourists
1. **Book Package**: Tourist books a tour package
2. **Driver Accepts**: Tourist receives notification that driver accepted
3. **Payment Deadline**: Tourist has 12 hours to complete payment
4. **Pay**: Tourist completes payment via GCash/PayMaya
5. **Confirmation**: Tourist receives confirmation and can track driver

## Payment Validation Rules

### ✅ Driver CAN Start Trip When:
- Booking status is `driver_assigned` or `accepted`
- Payment status is `paid`
- Booking date is today or in the past
- Driver has eligible carriage assigned

### ❌ Driver CANNOT Start Trip When:
- Payment status is `pending` (not paid yet)
- Booking date is in the future
- Booking is cancelled or expired
- Driver has no eligible carriage

## Technical Implementation

### Files Modified
1. **`src/services/tourpackage/acceptBooking.js`**
   - `driverStartBooking()`: Backend validation for payment status
   - Error handling for payment required scenarios

2. **`src/screens/main/DriverBookScreen.js`**
   - Payment status display in earnings section
   - Conditional rendering of Start Trip button
   - User-friendly error messages

### API Endpoints
- **POST** `/api/tour-booking/start/{booking_id}/`
  - Validates payment status before starting trip
  - Returns error if payment is pending

### Error Codes
- `PAYMENT_REQUIRED`: Booking payment is pending, cannot start trip

## Benefits

### For Drivers
- ✅ Guaranteed payment before starting trip
- ✅ Clear visibility of payment status
- ✅ No risk of unpaid trips
- ✅ Automatic notifications when payment received

### For Tourists
- ✅ Secure payment before trip starts
- ✅ Clear payment deadline (12 hours)
- ✅ Confirmation when payment successful
- ✅ Driver cannot start until payment confirmed

### For Platform
- ✅ Ensures revenue collection
- ✅ Reduces payment disputes
- ✅ Protects driver earnings
- ✅ Maintains trust in the system

## Testing Scenarios

### Scenario 1: Normal Flow
1. Tourist books package → Driver accepts → Tourist pays → Driver starts trip ✅

### Scenario 2: Unpaid Booking
1. Tourist books package → Driver accepts → Tourist doesn't pay
2. Driver tries to start trip → Error: "Payment Required" ❌
3. Tourist pays → Driver can now start trip ✅

### Scenario 3: Payment Timeout
1. Tourist books package → Driver accepts → 12 hours pass without payment
2. Booking automatically cancelled → Driver notified ❌
3. Booking reopened for other drivers to accept

## Future Enhancements
- [ ] Add payment reminder notifications for tourists
- [ ] Show estimated payment deadline to drivers
- [ ] Add partial payment support for large bookings
- [ ] Implement automatic refunds for cancelled trips

## Related Documentation
- `PAYMENT_TIMEOUT_IMPLEMENTATION.md` - Payment deadline system
- `DRIVER_PACKAGE_BOOKING_FILTER.md` - Driver package filtering
- `BOOKING_FIXES.md` - General booking system fixes

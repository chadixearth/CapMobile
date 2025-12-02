# Driver-Created Package Payment Fix

## Issue
When tourists book **driver-created tour packages**, the booking shows `driver_assigned` status but `payment_status: pending`. This prevents drivers from starting the trip even though they created the package.

## Root Cause
The current booking flow treats all packages the same:
1. Tourist books package → Status: `pending`, Payment: `pending`
2. Driver accepts → Status: `driver_assigned`, Payment: still `pending`
3. Tourist pays → Payment: `paid`
4. Driver can start trip

This flow makes sense for **admin-created packages** where any driver can accept, but NOT for **driver-created packages** where the driver is already known.

## Solution

### For Driver-Created Packages
Tourists should pay IMMEDIATELY when booking (before booking is created):

```
Tourist selects package → Tourist pays → Booking created with payment_status: 'paid' → Driver notified
```

### For Admin-Created Packages
Keep current flow (pay after driver accepts):

```
Tourist books → Driver accepts → Tourist pays → Driver starts trip
```

## Implementation

### Backend Changes Needed
1. **Identify package creator** in booking API
2. **Require immediate payment** for driver-created packages
3. **Set payment_status: 'paid'** when booking is created with payment
4. **Set status: 'driver_assigned'** automatically (skip pending state)

### Frontend Changes

#### 1. Update BookScreen.js (Tourist Booking)
```javascript
// Check if package is driver-created
const isDriverPackage = packageData.created_by_driver || packageData.driver_id;

if (isDriverPackage) {
  // Redirect to payment BEFORE creating booking
  navigation.navigate('Payment', {
    packageData,
    bookingData,
    onPaymentSuccess: (paymentId) => {
      // Create booking with payment_status: 'paid'
      createBooking({
        ...bookingData,
        payment_status: 'paid',
        payment_id: paymentId,
        status: 'driver_assigned', // Skip pending
        driver_id: packageData.driver_id
      });
    }
  });
} else {
  // Admin package - create booking first, pay later
  createBooking(bookingData);
}
```

#### 2. Update requestBooking.js
```javascript
const payload = {
  package_id: bookingData.package_id,
  customer_id: bookingData.customer_id,
  booking_date: normalizeDate(bookingData.booking_date),
  pickup_time: sanitizeTime(bookingData.pickup_time),
  number_of_pax: Number(bookingData.number_of_pax) || 1,
  total_amount: Number(bookingData.total_amount) || 0,
  special_requests: bookingData.special_requests || '',
  contact_number: String(bookingData.contact_number || ''),
  pickup_address: bookingData.pickup_address || '',
  status: bookingData.status || 'pending',
  payment_status: bookingData.payment_status || 'pending', // ✅ Added
  payment_id: bookingData.payment_id || null, // ✅ Added
  driver_id: bookingData.driver_id || null, // ✅ Added for driver packages
};
```

## Quick Fix (Temporary)

Until backend is updated, manually update bookings in database:

```sql
-- For driver-created packages that are already booked
UPDATE tour_bookings 
SET payment_status = 'paid',
    payment_id = 'MANUAL_FIX_' || id
WHERE status = 'driver_assigned' 
  AND payment_status = 'pending'
  AND package_id IN (
    SELECT id FROM tour_packages WHERE created_by_driver IS NOT NULL
  );
```

## Testing

### Test Case 1: Driver-Created Package
1. Driver creates package
2. Tourist books package
3. **Expected**: Redirect to payment immediately
4. Tourist completes payment
5. **Expected**: Booking created with `payment_status: 'paid'` and `status: 'driver_assigned'`
6. Driver sees booking in "Ongoing" tab
7. **Expected**: "Start Trip" button is enabled (not "Waiting for Payment")

### Test Case 2: Admin-Created Package
1. Admin creates package
2. Tourist books package
3. **Expected**: Booking created with `status: 'pending'`
4. Driver accepts booking
5. **Expected**: Status changes to `driver_assigned`, payment still `pending`
6. Tourist completes payment
7. **Expected**: Payment status changes to `paid`
8. Driver can now start trip

## Benefits

### For Drivers
- ✅ Guaranteed payment for their own packages
- ✅ Can start trips immediately on booking date
- ✅ No waiting for tourist payment
- ✅ Better control over their packages

### For Tourists
- ✅ Instant confirmation for driver packages
- ✅ Clear payment flow
- ✅ No confusion about when to pay
- ✅ Faster booking process

## Related Files
- `src/services/tourpackage/requestBooking.js` - Booking creation
- `src/services/tourpackage/acceptBooking.js` - Driver acceptance & start trip
- `src/screens/main/DriverBookScreen.js` - Driver booking UI
- `src/screens/main/BookScreen.js` - Tourist booking UI (needs update)
- `src/screens/main/PaymentScreen.js` - Payment processing

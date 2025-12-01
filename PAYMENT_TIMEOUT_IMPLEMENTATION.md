# Payment Timeout & Automatic Booking Cancellation

## Overview
This implementation automatically cancels tour package bookings if the tourist fails to complete payment within 24 hours after the driver accepts the booking. The system also sends notifications to tourists about payment deadlines and cancellations.

## Architecture

### Services

#### 1. **paymentTimeoutService.js**
Located: `src/services/tourpackage/paymentTimeoutService.js`

Core service handling payment timeout logic:

- **checkAndCancelUnpaidBookings()** - Main function that:
  - Calls backend endpoint to identify unpaid bookings exceeding 24-hour deadline
  - Automatically cancels those bookings
  - Notifies affected tourists
  - Invalidates booking cache

- **getBookingsNearPaymentDeadline()** - Fetches bookings within 1 hour of payment deadline for reminder notifications

- **sendPaymentReminder()** - Sends payment reminder notifications to tourists

- **getBookingPaymentStatus()** - Checks payment status for a specific booking

#### 2. **paymentTimeoutScheduler.js**
Located: `src/services/paymentTimeoutScheduler.js`

Scheduler service that runs periodic checks:

- **start()** - Initializes two intervals:
  - Payment timeout check: Every 5 minutes
  - Payment reminder: Every 10 minutes

- **stop()** - Stops all scheduled intervals

- **triggerCheck()** - Manually trigger payment timeout check

- **setCheckInterval()** - Adjust check frequency

## Flow Diagram

```
Driver Accepts Booking
    ↓
Payment Deadline Set (24 hours from acceptance)
    ↓
Scheduler Checks Every 5 Minutes
    ↓
Is Payment Received?
    ├─ YES → Booking Continues
    └─ NO → Check if 24 hours passed
            ├─ YES → Cancel Booking + Notify Tourist
            └─ NO → Continue Monitoring
```

## Notification Flow

### Payment Reminder (1 hour before deadline)
```
Booking Near Deadline
    ↓
Send Notification: "Payment Reminder - Complete Your Booking 💳"
    ↓
Tourist Receives: "Please complete payment by [deadline] to confirm your tour"
```

### Automatic Cancellation (After 24 hours)
```
Payment Deadline Exceeded
    ↓
System Cancels Booking
    ↓
Send Notification: "Payment Timeout - Booking Cancelled ⏰❌"
    ↓
Tourist Receives: "Your booking was automatically cancelled due to payment timeout"
```

## Integration Points

### 1. App Initialization
In `src/App.js`:
```javascript
import paymentTimeoutScheduler from './services/paymentTimeoutScheduler';

// In initializeApp()
paymentTimeoutScheduler.start();
```

### 2. Backend Endpoints Required
The implementation expects these backend endpoints:

- **POST** `/api/tour-booking/cancel-unpaid-bookings/`
  - Cancels bookings exceeding 24-hour payment deadline
  - Returns: `{ success: true, data: { cancelled_bookings: [...] } }`

- **GET** `/api/tour-booking/bookings-near-deadline/`
  - Fetches bookings within 1 hour of payment deadline
  - Returns: `{ success: true, data: { bookings: [...] } }`

- **GET** `/api/tour-booking/{bookingId}/payment-status/`
  - Checks payment status for a booking
  - Returns: `{ success: true, data: { payment_status: 'paid'|'pending' } }`

## Configuration

### Check Intervals
Default intervals (in milliseconds):
- Payment timeout check: 5 minutes (300,000 ms)
- Payment reminder: 10 minutes (600,000 ms)

To customize:
```javascript
import paymentTimeoutScheduler from './services/paymentTimeoutScheduler';

// Change check interval to 10 minutes
paymentTimeoutScheduler.setCheckInterval(10 * 60 * 1000);
```

### Payment Deadline
Default: 24 hours (defined in `paymentTimeoutService.js`)
```javascript
const PAYMENT_TIMEOUT_HOURS = 24;
```

## Notification Messages

### Payment Reminder
- **Title**: "Payment Reminder - Complete Your Booking 💳"
- **Message**: "Please complete payment by [deadline] to confirm your tour. Your booking will be automatically cancelled if payment is not received."
- **Type**: `payment_reminder`

### Automatic Cancellation
- **Title**: "Payment Timeout - Booking Cancelled ⏰❌"
- **Message**: "Your tour package booking was automatically cancelled because payment was not completed within 24 hours of driver acceptance. Please book again if interested."
- **Type**: `booking_cancelled_payment_timeout`

## Error Handling

The implementation includes robust error handling:

1. **Network Errors**: Gracefully handles API failures without crashing
2. **Missing Data**: Validates booking data before processing
3. **Notification Failures**: Non-critical errors don't block cancellation process
4. **Scheduler Errors**: Catches errors in intervals to prevent scheduler crash

## Logging

All operations are logged with `[PaymentTimeout]` prefix:
```
[PaymentTimeout] Checking for unpaid bookings exceeding 24-hour deadline...
[PaymentTimeout] Cancelled 2 unpaid bookings
[PaymentTimeout] Tourist notifications sent: {...}
```

## Testing

### Manual Trigger
```javascript
import paymentTimeoutScheduler from './services/paymentTimeoutScheduler';

// Manually trigger check
await paymentTimeoutScheduler.triggerCheck();
```

### Check Scheduler Status
```javascript
if (paymentTimeoutScheduler.isActive()) {
  console.log('Scheduler is running');
}
```

## Data Invalidation

When bookings are cancelled, the system invalidates:
- Booking cache (triggers refresh across all screens)
- Ensures UI reflects latest booking status

## Security Considerations

1. **Backend Validation**: All cancellations are validated on backend
2. **Customer Verification**: Backend verifies customer ownership before cancellation
3. **Audit Trail**: All cancellations are logged with timestamps
4. **Notification Verification**: Only registered tourists receive notifications

## Future Enhancements

1. **Configurable Deadlines**: Allow different payment deadlines per booking type
2. **Grace Period**: Add grace period before final cancellation
3. **Payment Retry**: Automatic retry for failed payments
4. **Escalation**: Notify driver/admin if booking cancelled
5. **Analytics**: Track cancellation reasons and patterns

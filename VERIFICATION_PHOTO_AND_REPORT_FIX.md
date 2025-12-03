# Verification Photo & Report System Implementation

## Issues Fixed

### 1. Verification Photo Upload Bug
**Problem**: Driver uploads verification photo upon completing tour package, but tourist sees "No verification photo uploaded" in their booking history.

**Root Cause**: 
- Inconsistent error handling in `getVerificationStatus` function
- Missing proper logging to debug photo retrieval
- Potential backend API response format mismatch

**Solution**:
- Enhanced `getVerificationStatus` in `bookingVerification.js` with better error handling
- Added comprehensive logging to track photo retrieval
- Updated `BookingHistoryScreen.js` to handle multiple response formats from backend
- Added visual indicator showing "No Verification Photo" when photo is missing vs "View Completion Photo" when available

**Files Modified**:
- `src/services/tourpackage/bookingVerification.js`
- `src/screens/main/BookingHistoryScreen.js`

### 2. Report Functionality Implementation
**Problem**: Only rate/review functionality existed after trip completion. No way for tourists to report drivers for issues.

**Solution**: Implemented comprehensive report system with admin justification.

**Features Added**:
1. **Tourist Report Driver**:
   - Tourists can report drivers after completed trips
   - Predefined report reasons specific to tourist complaints:
     - Driver was rude or unprofessional
     - Driver was late or did not show up
     - Unsafe driving behavior
     - Vehicle was in poor condition
     - Driver took wrong route or overcharged
     - Driver did not follow agreed itinerary
     - Other (with custom reason)
   
2. **Driver Report Tourist** (existing, enhanced):
   - Predefined report reasons for driver complaints:
     - Tourist was rude or disrespectful
     - Tourist was late or no-show
     - Tourist damaged vehicle
     - Tourist requested unsafe activities
     - Payment issues
     - Other (with custom reason)

3. **Admin Justification System**:
   - All reports are submitted with status: 'pending'
   - Reports include reporter_type ('driver' or 'tourist')
   - Backend admin can review and justify/unjustify reports
   - Unjustified reports result in suspension warning
   - Warning message shown to users when submitting reports

**Files Created**:
- `src/screens/main/ReportDriverScreen.js` - New screen for tourist to report drivers

**Files Modified**:
- `src/services/reportService.js` - Added `submitDriverReport` and `getUserReports` functions
- `src/components/ReportModal.js` - Added support for both driver and tourist report reasons
- `src/screens/main/CompletionPhotoScreen.js` - Enhanced to support tourist reports
- `src/screens/main/BookingHistoryScreen.js` - Added "Report" button alongside "Review" button
- `src/navigation/RootNavigator.js` - Added ReportDriverScreen to navigation

## User Flow

### Tourist Reporting Driver:
1. Tourist goes to Booking History
2. Finds completed booking
3. Sees two buttons: "Review" and "Report"
4. Clicks "Report" button
5. Navigates to ReportDriverScreen with warning about unjustified reports
6. Selects reason from predefined list or enters custom reason
7. Adds optional description
8. Submits report
9. Report goes to admin with status: 'pending'
10. Admin reviews and marks as justified/unjustified
11. If unjustified, tourist may face account suspension

### Driver Reporting Tourist (existing flow, enhanced):
1. Driver completes trip and uploads verification photo
2. After upload, sees "Report Issue" button
3. Clicks report button
4. Selects reason from driver-specific list
5. Adds optional description
6. Submits report
7. Same admin review process

## Backend Requirements

The mobile app expects the following API endpoints:

### 1. Driver Report Endpoint
```
POST /api/reports/driver-report/
Body: {
  booking_id: string,
  driver_id: string,
  reporter_id: string,
  reporter_type: 'tourist',
  status: 'pending',
  reason: string,
  description: string (optional)
}
```

### 2. Trip Report Endpoint (existing, enhanced)
```
POST /api/reports/trip-report/
Body: {
  booking_id: string,
  driver_id: string,
  reporter_type: 'driver',
  reason: string,
  description: string (optional)
}
```

### 3. Get User Reports
```
GET /api/reports/user-reports/{userId}/?type={driver|tourist}
Response: {
  success: true,
  data: [
    {
      id: string,
      booking_id: string,
      reporter_type: string,
      status: 'pending' | 'justified' | 'unjustified',
      reason: string,
      description: string,
      created_at: timestamp,
      admin_notes: string (optional)
    }
  ]
}
```

### 4. Verification Photo Endpoint (existing, needs to ensure proper response)
```
GET /api/tour-booking/verification/{bookingId}/?customer_id={customerId}
Response: {
  success: true,
  data: {
    verification_available: boolean,
    verification_photo_url: string | null
  }
}
```

## Admin Dashboard Requirements

The admin dashboard should have:

1. **Reports Management Section**:
   - List all pending reports
   - Filter by reporter_type (driver/tourist)
   - View full report details including booking info
   - Mark report as "Justified" or "Unjustified"
   - Add admin notes
   - Track report history per user

2. **Suspension System**:
   - Track unjustified reports per user
   - Automatic suspension after X unjustified reports
   - Manual suspension override
   - Suspension appeal system

3. **Report Analytics**:
   - Most common report reasons
   - Users with most reports (justified vs unjustified)
   - Report resolution time
   - Suspension statistics

## Testing Checklist

### Verification Photo:
- [ ] Driver uploads photo after completing trip
- [ ] Photo appears in driver's completed bookings
- [ ] Tourist can see photo in their booking history
- [ ] "No Verification Photo" shows when photo not uploaded
- [ ] Photo modal opens correctly when clicking "View Completion Photo"

### Tourist Report Driver:
- [ ] Report button appears for completed bookings
- [ ] ReportDriverScreen opens with booking details
- [ ] Warning message displays about unjustified reports
- [ ] Tourist-specific report reasons show in modal
- [ ] Report submits successfully
- [ ] Success message shows with admin review notice
- [ ] Report appears in admin dashboard as pending

### Driver Report Tourist:
- [ ] Report button appears after photo upload
- [ ] Driver-specific report reasons show in modal
- [ ] Report submits successfully
- [ ] Report appears in admin dashboard as pending

## Security Considerations

1. **Report Validation**:
   - Verify booking exists and is completed
   - Verify reporter is part of the booking
   - Prevent duplicate reports for same booking
   - Rate limiting on report submissions

2. **Admin Authorization**:
   - Only admins can justify/unjustify reports
   - Audit log for admin actions
   - Prevent report tampering

3. **User Protection**:
   - Clear warning about false reports
   - Appeal process for suspensions
   - Transparent report history for users

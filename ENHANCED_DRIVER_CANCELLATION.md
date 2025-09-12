# Enhanced Driver Cancellation System

## Overview
Enhanced the existing driver cancellation system to provide better reporting and admin visibility when drivers cancel bookings.

## Key Improvements

### 1. **Enhanced Reporting**
- Driver cancellations now create detailed reports with structured metadata
- Reports include booking context, customer info, and cancellation reason
- Admin notifications direct to reports page for detailed review

### 2. **Better Reason Categories**
Added more specific cancellation reasons:
- Vehicle breakdown
- Personal emergency
- Traffic/road conditions
- Customer no-show
- Safety concerns
- Double booking
- Weather conditions
- Health issues
- Family emergency
- **Customer behavior issues** (new)
- **Route/location problems** (new)
- Other

### 3. **Structured Metadata**
Reports now include JSON metadata with:
- Cancellation reason
- Driver name
- Customer name
- Package name
- Booking reference
- Booking date
- Total amount

## Files Modified

### Mobile App
1. **`src/services/tourpackage/driverCancellation.js`**
   - Added more specific cancellation reasons
   - Enhanced reason categories

2. **`src/components/DriverCancellationModal.js`**
   - Updated warning messages
   - Better consequence explanation

### Backend API
1. **`api/booking.py`**
   - Enhanced `driver_cancel_booking` endpoint
   - Removed immediate metrics recording
   - Added structured metadata to reports

2. **`api/reports.py`**
   - Added `review_driver_cancellation` endpoint
   - Admin decision handling for metrics

### Admin UI (New)
1. **`reports/templates/reports/report_detail.html`**
   - Added driver cancellation review form
   - Justified/unjustified decision options
   - Visual indicators for pending reviews

2. **`reports/templates/reports/reports_list.html`**
   - Enhanced action buttons for cancellation reports
   - "Review Required" warning indicators

## How It Works

### Driver Cancellation Flow:
1. **Driver initiates cancellation** via mobile app
2. **Reason selection** from predefined list or custom input
3. **Report creation** with detailed metadata in `reports` table
4. **Admin notification** with link to reports page
5. **Tourist notification** about reassignment
6. **Booking reassignment** to other available drivers
7. **⚠️ NO immediate metrics impact** - awaits admin review

### Admin Review Process:
1. **Notification received** about driver cancellation
2. **Reports page access** to view detailed cancellation report
3. **Structured data review** including reason and context
4. **Admin decision**: Mark as "justified" or "unjustified"
5. **Metrics impact**: Only unjustified cancellations affect driver metrics
6. **Suspension check**: Only triggered for unjustified cancellations

## API Endpoints

### Driver Cancellation (Enhanced)
**POST** `/api/tour-booking/driver-cancel/{booking_id}/`

**Request Body**:
```json
{
  "driver_id": "string",
  "reason": "string"
}
```

**Response** (No immediate metrics impact):
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "pending",
    "excluded_drivers": ["driver_id"]
  },
  "message": "Booking cancelled and reassigned...",
  "reassignment_status": "broadcasted",
  "driver_suspended": null
}
```

### Admin Review (New)
**POST** `/api/reports/review_driver_cancellation/`

**Request Body**:
```json
{
  "report_id": "uuid",
  "decision": "justified|unjustified",
  "admin_notes": "string",
  "admin_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cancellation marked as unjustified. Driver metrics updated.",
  "driver_suspended": false
}
```

## Admin UI Features

### Reports List Page
- **Visual Indicators**: Driver cancellation reports show "⚠️ Review Required" button
- **Filtering**: Filter by report type to see only driver cancellations
- **Status Tracking**: Clear status indicators for pending reviews

### Report Detail Page
- **Review Form**: Appears only for pending driver cancellation reports
- **Decision Options**: 
  - ✅ **Justified** (No penalty) - For valid reasons like emergencies
  - ❌ **Unjustified** (Affects metrics) - For invalid cancellations
- **Required Notes**: Admin must explain their decision
- **Immediate Feedback**: Shows result of review submission

### Reports Viewing
**GET** `/api/reports/?type=driver_cancellation`

Returns all driver cancellation reports with admin decisions.

## Database Schema

### Reports Table Enhancement
- `report_type`: Now includes `driver_cancellation`
- `metadata`: JSONB field with structured cancellation data
- Enhanced indexing for better performance

## Testing

Run the test script:
```bash
node test_driver_cancellation_reports.js
```

## Benefits

1. **Fair Driver Treatment**: Admin review prevents unjust metric penalties
2. **Better Admin Oversight**: Detailed reports with context
3. **Pattern Recognition**: Structured data for trend analysis
4. **Improved Accountability**: Clear reason tracking with admin validation
5. **Enhanced User Experience**: Better communication to tourists
6. **Data-Driven Decisions**: Rich metadata for policy decisions
7. **Justified Cancellation Protection**: Valid reasons don't affect driver standing

## Usage Notes

- All driver cancellations create reports but **don't immediately affect metrics**
- Admin must review and mark cancellations as "justified" or "unjustified"
- Only **unjustified cancellations** count toward driver metrics and suspension
- **Justified cancellations** (emergencies, customer issues) have no penalty
- Reports are immediately visible to admins for review
- Tourist notifications include reassignment status
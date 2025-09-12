# Trip Report Feature

## Overview
Added a report button that appears after trip completion, allowing drivers to report issues with tourists or the trip experience.

## Files Modified/Created

### Mobile App (CapMobile)
1. **`src/services/reportService.js`** - New service for handling report API calls
2. **`src/components/ReportModal.js`** - New modal component for report submission
3. **`src/screens/main/CompletionPhotoScreen.js`** - Modified to include report functionality after trip completion

### Backend API (CapstoneWeb)
1. **`api/reports.py`** - Added `trip_report` endpoint
2. **`sql/create_reports_table.sql`** - Updated to support `trip_issue` type and metadata
3. **`update_reports_table.py`** - Migration script for database updates

## How It Works

1. **Trip Completion Flow**:
   - Driver completes trip by uploading photo
   - After successful completion, two buttons appear:
     - "Report Issue" (red button with flag icon)
     - "Done" (green button with checkmark)

2. **Report Submission**:
   - Driver taps "Report Issue" button
   - Modal opens with predefined reasons:
     - Tourist was rude or disrespectful
     - Tourist was late or no-show
     - Tourist damaged vehicle
     - Tourist requested unsafe activities
     - Payment issues
     - Other (with custom input)
   - Optional description field for additional details
   - Report is submitted to backend API

3. **Backend Processing**:
   - Report stored in `reports` table with type `trip_issue`
   - Admin notification created
   - Report includes booking context and metadata

## API Endpoint

**POST** `/api/reports/trip_report/`

**Request Body**:
```json
{
  "booking_id": "string",
  "driver_id": "string", 
  "reason": "string",
  "description": "string (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "report_type": "trip_issue",
    "title": "Trip Issue Report - Booking #123",
    "status": "pending",
    "created_at": "2025-01-09T..."
  },
  "message": "Trip report submitted successfully"
}
```

## Database Schema

The `reports` table includes:
- `report_type`: Now supports `trip_issue`
- `metadata`: JSONB field for structured data
- Standard fields: title, description, reporter_id, etc.

## Testing

Run the test script:
```bash
node test_report_functionality.js
```

## Usage Notes

- Report button only appears after successful trip completion
- Reports are sent to admin for review
- Driver can choose from predefined reasons or enter custom reason
- All reports include booking context for admin investigation
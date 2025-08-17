# Custom Package Request Feature Guide

## Overview
This feature allows tourists to create custom tour package requests and special event bookings directly from the mobile app. Only users with the "tourist" role can access this functionality.

## Features Implemented

### 1. Custom Package Request Service (`src/services/specialpackage/customPackageRequest.js`)
- **API Endpoints**: Integrates with Django backend using separate endpoints:
  - `/api/custom-tour-requests/` - For custom tour packages
  - `/api/special-event-requests/` - For special events
- **Functions**:
  - `createCustomTourRequest()` - Create custom tour package requests
  - `createSpecialEventRequest()` - Create special event requests (weddings, birthdays, etc.)
  - `getCustomerCustomRequests()` - Get customer's request history
  - `getAllCustomRequests()` - Get all requests (admin use)
  - `getCustomRequestById()` - Get specific request details
  - `updateCustomRequestStatus()` - Update request status (admin only)

### 2. Custom Package Request Screen (`src/screens/main/CustomPackageRequestScreen.js`)
- **Two Request Types**:
  - **Custom Tour**: Package name, description, destination, preferred price, duration, dates
  - **Special Event**: Event type, date/time, price range, special requirements
- **Features**:
  - Form validation
  - Date/time pickers
  - Dynamic form fields based on request type
  - Role-based access (tourists only)
  - Contact information auto-fill from user profile

### 3. Custom Request History Screen (`src/screens/main/CustomRequestHistoryScreen.js`)
- **Display Features**:
  - List of all customer's custom requests
  - Status indicators with color coding (pending, approved, rejected, etc.)
  - Request type icons (tour vs. special event)
  - Detailed request information
  - Admin responses display
  - Pull-to-refresh functionality
  - Empty state with call-to-action

### 4. BookScreen Integration (`src/screens/main/BookScreen.js`)
- **Added Custom Request History Button**:
  - Only visible for tourist role users
  - Clock/time icon for easy identification
  - Located in header actions area
  - Role-based access control: `(user?.role === 'tourist' || (!user?.role && user))`

### 5. TouristHomeScreen Integration (`src/screens/main/TouristHomeScreen.js`)
- **Added Custom Request Button**:
  - Located next to "Tour Packages" section title
  - Plus icon with "Custom Request" text
  - Easy access for creating new requests

### 6. Navigation Updates (`src/navigation/RootNavigator.js`, `src/constants/routes.js`)
- **New Routes**:
  - `CUSTOM_PACKAGE_REQUEST` - Create new custom requests
  - `CUSTOM_REQUEST_HISTORY` - View request history
- **Screen Registration**: Both screens added to stack navigator

## Role-Based Access Control

### Tourist Users
- ✅ Can create custom tour package requests
- ✅ Can create special event requests
- ✅ Can view their request history
- ✅ Can see admin responses
- ✅ Access via BookScreen history button
- ✅ Access via TouristHomeScreen custom request button

### Driver/Owner Users
- ❌ Cannot see custom request buttons
- ❌ Cannot access custom request screens
- ❌ Role-based UI elements are hidden

## Request Types Supported

### Custom Tour Package
- Package name and description
- Destination and pickup location
- Preferred price and duration
- Preferred date and available days
- Number of passengers
- Special requests

### Special Event
- Event type (Wedding, Birthday, Corporate, etc.)
- Event date and time
- Number of passengers
- Pickup location and destination
- Preferred price range
- Special requirements

## Status Flow
1. **Pending** - Initial status when request is created
2. **Approved** - Admin has approved the request
3. **Rejected** - Admin has rejected the request
4. **In Progress** - Request is being processed
5. **Completed** - Request has been fulfilled

## Backend Integration
- Uses existing Django backend API
- Follows same authentication pattern as other services
- Error handling and validation
- Timeout protection (15 seconds)
- Proper JSON response handling

## Dependencies Added
- `@react-native-community/datetimepicker` - For date and time selection

## Usage Instructions

### For Tourists:
1. **Create Request**: 
   - Go to Home screen → Tap "Custom Request" button
   - OR go to Book screen → Tap "Custom Requests" button → Tap "New Request"
2. **Choose Type**: Select between Custom Tour or Special Event
3. **Fill Form**: Complete required fields based on request type
4. **Submit**: Request is sent to admin for review
5. **Track Status**: View status updates in Custom Request History

### For Developers:
- All custom request functionality is contained in dedicated files
- Role checking is implemented at UI level
- API service follows established patterns
- Error handling and loading states included
- Responsive design for different screen sizes

## API Endpoints Used
- `POST /api/custom-tour-requests/` - Create custom tour requests
- `POST /api/special-event-requests/` - Create special event requests
- `GET /api/custom-tour-requests/?customer_id={id}` - Get customer tour requests
- `GET /api/special-event-requests/?customer_id={id}` - Get customer event requests
- `GET /api/custom-tour-requests/{id}/` - Get specific tour request
- `GET /api/special-event-requests/{id}/` - Get specific event request
- `PATCH /api/custom-tour-requests/{id}/` - Update tour request (admin)
- `PATCH /api/special-event-requests/{id}/` - Update event request (admin)

This feature provides a complete solution for tourists to request custom tour packages and special event services while maintaining proper role-based access control.

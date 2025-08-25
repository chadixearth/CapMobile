# Driver Earnings Integration

This document outlines the integration of tour package earnings functionality into the DriverHomeScreen.

## Overview

The integration connects the mobile app to the tour package earnings API endpoints to display real-time earnings data for drivers. When drivers complete tour bookings, their earnings (80% of the total amount) are automatically calculated and displayed.

## API Integration

### Backend Endpoints Used
- `GET /api/earnings/tour_package_earnings/` - Get driver's tour package earnings
- `GET /api/earnings/driver_earnings/` - Get aggregated driver earnings data

### Earnings Distribution
- **Driver Share**: 80% of total booking amount
- **Admin Share**: 20% of total booking amount

## New Components

### 1. EarningsService (`src/services/earningsService.js`)
- `getDriverEarnings(driverId, filters)` - Fetch driver earnings with optional filters
- `getDriverEarningsStats(driverId, period)` - Get earnings statistics for a specific period
- `getEarningsPercentageChange(driverId, period)` - Calculate percentage change between periods
- `formatCurrency(amount)` - Format currency values
- `formatPercentage(percentage)` - Format percentage values

### 2. Enhanced DriverHomeScreen (`src/screens/main/DriverHomeScreen.js`)
**New Features:**
- Real-time earnings display in income card
- Percentage change indicators (increase/decrease from previous period)
- Today's earnings breakdown
- Driver percentage information (80% share)
- Real earnings notifications from completed bookings
- Pull-to-refresh functionality
- Navigation to detailed earnings screen

**Income Card Enhancements:**
- Shows actual monthly earnings instead of static amount
- Displays percentage change with trend indicators
- Shows today's earnings when available
- Includes average earnings per booking
- Shows total completed bookings count

### 3. DriverEarningsScreen (`src/screens/main/DriverEarningsScreen.js`)
**New detailed earnings screen with:**
- Period selector (Today, Week, Month, All)
- Earnings overview with statistics
- Detailed earnings history
- Individual booking earnings breakdown
- Percentage change tracking
- Refresh functionality

## Navigation Updates

### Routes Added
- `DRIVER_EARNINGS = 'DriverEarnings'` in `src/constants/routes.js`

### Navigation Integration
- Added DriverEarningsScreen to RootNavigator stack
- Income card in DriverHomeScreen navigates to detailed view
- Proper authentication checks for earnings access

## Data Flow

1. **User Authentication**: Get current driver ID from auth system or Supabase fallback
2. **Earnings Fetch**: Call earnings API with driver ID and filters
3. **Data Processing**: Calculate statistics, percentage changes, and format currencies
4. **UI Updates**: Display real-time earnings in income card and notifications
5. **Detailed View**: Navigate to comprehensive earnings breakdown

## Real-time Features

### Notifications
- Automatically generate earnings notifications from completed bookings
- Show actual earning amounts with currency formatting
- Display package names and completion times
- Include booking summary statistics

### Income Card
- Monthly earnings total
- Percentage change from previous month
- Today's earnings (when available)
- Driver/admin split information
- Average earnings per booking

### Detailed Earnings
- Period-based filtering (Today, Week, Month, All)
- Individual booking earnings history
- Total statistics and trends
- Refresh capabilities

## Error Handling

- Network timeout handling (30 seconds)
- Fallback to default data on API failures
- User authentication validation
- Graceful error messages
- Loading states during data fetching

## Currency Formatting

All amounts are formatted as Philippine Peso (₱) with proper thousand separators:
- `₱1,500.00` for earnings amounts
- `+7.2%` for percentage changes
- Consistent 2 decimal places

## Usage

1. Driver logs in and navigates to DriverHomeScreen
2. Real earnings data loads automatically from API
3. Income card shows current month's earnings
4. Tap income card arrow to view detailed earnings
5. Use period selector in detailed view for different timeframes
6. Pull down to refresh data anytime

## Benefits

- **Real-time Accuracy**: Shows actual earnings from completed bookings
- **Transparency**: Clear breakdown of driver vs admin shares
- **User Engagement**: Visual trends and statistics keep drivers informed
- **Performance Tracking**: Historical data helps drivers track progress
- **Professional Interface**: Clean, modern UI following app design patterns

## Future Enhancements

- Push notifications for new earnings
- Weekly/monthly earning goals
- Earnings analytics charts
- Payout request integration
- Tax summary reports
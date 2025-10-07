# Breakeven Notifications Implementation

## Overview
The breakeven notification system provides real-time notifications to drivers when they reach important financial milestones, helping them track their progress toward profitability and make informed decisions about their work.

## Architecture

### Backend Components

#### 1. BreakevenNotificationService (`api/breakeven_notifications.py`)
- **Purpose**: Core service for handling breakeven-related notifications
- **Key Features**:
  - Automatic breakeven status detection
  - Milestone tracking (₱500, ₱1000, ₱2000, ₱5000 profit levels)
  - Deficit warnings when drivers are significantly behind
  - Non-blocking notification processing

#### 2. Integration with Breakeven API (`api/breakeven.py`)
- **Purpose**: Automatically triggers notifications when breakeven data is calculated
- **Implementation**: 
  - Runs notification checks in background threads
  - Compares current vs previous breakeven status
  - Triggers appropriate notifications based on status changes

#### 3. API Endpoints
- `POST /api/notifications/breakeven/` - Manually trigger breakeven notifications
- `GET /api/notifications/breakeven/?driver_id={id}` - Get recent breakeven notifications

### Mobile Components

#### 1. BreakevenNotificationManager (`src/services/breakeven.js`)
- **Purpose**: Client-side breakeven notification management
- **Key Features**:
  - Milestone detection and notification sending
  - Local notification display
  - State persistence for comparison
  - Integration with existing NotificationService

#### 2. BreakevenNotificationBadge (`src/components/BreakevenNotificationBadge.js`)
- **Purpose**: UI component to display breakeven notifications
- **Features**:
  - Unread notification count badge
  - Modal with notification history
  - Real-time updates
  - Categorized notification icons and colors

#### 3. Integration with DriverBreakevenScreen
- **Purpose**: Seamless integration with existing breakeven calculator
- **Implementation**:
  - Automatic notification checks when expenses change
  - Notification badge in screen header
  - Real-time milestone detection

## Notification Types

### 1. Breakeven Achievement 🎯
- **Trigger**: When driver's revenue first covers their expenses
- **Message**: "Great job! You've reached your breakeven point with ₱{revenue} revenue covering ₱{expenses} expenses."
- **Timing**: Once per day when breakeven is first achieved

### 2. Profit Achievement 💰
- **Trigger**: When driver first starts making profit (revenue > expenses)
- **Message**: "Excellent! You're now earning profit of ₱{profit}. Your revenue exceeds your expenses."
- **Timing**: Once when profit is first achieved

### 3. Profit Milestones 🏆
- **Trigger**: When driver reaches ₱500, ₱1000, ₱2000, or ₱5000 profit levels
- **Message**: "Amazing achievement! You've reached ₱{milestone} in profit."
- **Timing**: Once per milestone level

### 4. Deficit Warnings 📊
- **Trigger**: When driver has significant deficit (₱200+) and has completed some rides
- **Message**: "You're ₱{deficit} away from breakeven. Complete about {rides} more rides."
- **Timing**: When deficit threshold is crossed

## Implementation Details

### Backend Notification Flow
1. Driver uses breakeven calculator (expenses change)
2. Breakeven API calculates current financial status
3. Background thread compares with previous status
4. Appropriate notifications are created in database
5. Mobile app receives notifications via existing system

### Mobile Notification Flow
1. DriverBreakevenScreen detects expense changes
2. BreakevenNotificationManager checks for milestones
3. Local notifications are displayed immediately
4. Server notifications are sent for persistence
5. Notification badge updates with unread count

### Data Storage
- **Backend**: Uses existing `notifications` and `notification_recipients` tables
- **Mobile**: Uses AsyncStorage for state persistence (`breakeven_last_{driverId}`)
- **Comparison**: Previous state stored for milestone detection

## Configuration

### Notification Thresholds
```javascript
static notificationThresholds = {
  profitMilestones: [500, 1000, 2000, 5000], // ₱ amounts
  deficitWarningThreshold: 200, // ₱ deficit threshold
};
```

### Backend Settings
- Non-blocking notification processing
- Automatic cleanup of old notification states
- Integration with existing notification infrastructure

## Testing

### Backend Testing
```bash
# Run the test script
node test_breakeven_notifications.js
```

### Mobile Testing
1. Open DriverBreakevenScreen
2. Add expenses to trigger calculations
3. Verify notifications appear in:
   - Local device notifications
   - Notification bell badge
   - BreakevenNotificationBadge modal
   - Main NotificationScreen

### Test Scenarios
1. **First Breakeven**: Set expenses = revenue
2. **Profit Achievement**: Set revenue > expenses
3. **Milestone**: Increase revenue to reach ₱500+ profit
4. **Deficit Warning**: Set high expenses with low revenue

## Integration Points

### Existing Systems
- **NotificationService**: Reuses existing notification infrastructure
- **BreakevenService**: Integrates with existing breakeven calculations
- **TARTRACKHeader**: Notification bell shows breakeven notifications
- **NotificationScreen**: Displays breakeven notifications in main list

### Database Tables
- **notifications**: Stores notification content
- **notification_recipients**: Links notifications to drivers
- **breakeven_history**: Used for state comparison

## User Experience

### Driver Journey
1. **Setup**: Driver enters daily expenses in breakeven calculator
2. **Progress**: Receives encouraging notifications as they complete rides
3. **Achievement**: Celebrates breakeven and profit milestones
4. **Motivation**: Gets progress updates when behind target

### Notification Timing
- **Immediate**: Local notifications appear instantly
- **Persistent**: Server notifications remain in history
- **Smart**: Avoids spam by checking previous state
- **Relevant**: Only triggers for meaningful changes

## Performance Considerations

### Backend
- Non-blocking notification processing
- Background thread execution
- Minimal database queries
- Error handling for failed notifications

### Mobile
- Efficient state comparison
- Local storage for persistence
- Debounced notification checks
- Graceful error handling

## Future Enhancements

### Potential Features
1. **Weekly/Monthly Summaries**: Aggregate breakeven performance
2. **Goal Setting**: Allow drivers to set custom profit targets
3. **Comparison Metrics**: Show performance vs other drivers
4. **Trend Analysis**: Identify patterns in breakeven achievement
5. **Push Notifications**: Background notifications when app is closed

### Analytics Integration
- Track notification engagement
- Measure impact on driver behavior
- Optimize notification timing and content
- A/B test different message formats

## Troubleshooting

### Common Issues
1. **Notifications Not Appearing**
   - Check notification permissions
   - Verify driver ID is valid
   - Ensure expenses > 0 for meaningful calculations

2. **Duplicate Notifications**
   - Check state persistence logic
   - Verify previous data comparison
   - Review notification timing

3. **Missing Milestones**
   - Verify threshold configuration
   - Check profit calculation accuracy
   - Review milestone detection logic

### Debug Tools
- Test script for backend API testing
- Console logs for mobile debugging
- Notification history in badge modal
- AsyncStorage inspection for state data

## Security Considerations

### Data Privacy
- Notifications contain only aggregated financial data
- No sensitive personal information in messages
- Driver-specific notifications only sent to correct user

### Access Control
- Notifications filtered by driver ID
- RLS policies protect notification access
- API endpoints require proper authentication

## Deployment Checklist

### Backend
- [ ] Deploy breakeven_notifications.py
- [ ] Update api/urls.py with new endpoints
- [ ] Test notification creation and retrieval
- [ ] Verify integration with existing breakeven API

### Mobile
- [ ] Deploy breakeven.js service
- [ ] Deploy BreakevenNotificationBadge component
- [ ] Update DriverBreakevenScreen integration
- [ ] Test notification flow end-to-end
- [ ] Verify local and server notifications work

### Testing
- [ ] Run backend test script
- [ ] Test mobile notification scenarios
- [ ] Verify notification persistence
- [ ] Check notification badge updates
- [ ] Test error handling and edge cases
# Notification Mark All As Read - Fix

## Issue
Error when marking all notifications as read:
```
ERROR [NotificationContext] Error marking all as read: 
[TypeError: _notificationService.default.markAllAsRead is not a function (it is undefined)]
```

## Root Cause
The `NotificationService` class was missing the `markAllAsRead()` method that was being called from `NotificationContext.js`.

## Solution
Added `markAllAsRead()` method to `NotificationService`:

```javascript
static async markAllAsRead(userId, notifications) {
  try {
    if (!notifications || notifications.length === 0) {
      return { success: true, message: 'No notifications to mark' };
    }
    
    const notificationIds = notifications.map(n => n.id);
    const result = await networkClient.put('/notifications/mark-all-read/', {
      user_id: userId,
      notification_ids: notificationIds
    }, {
      timeout: 5000,
      retries: 0
    });
    return result?.data || { success: true };
  } catch (error) {
    console.log('[NotificationService] Mark all read failed:', error.message);
    return { success: false, error: error.message };
  }
}
```

## What It Does
- Takes userId and array of notifications
- Extracts notification IDs
- Sends PUT request to backend `/notifications/mark-all-read/` endpoint
- Returns success/failure response
- Handles errors gracefully

## File Modified
- `src/services/notificationService.js`

## Testing
1. Open notification screen
2. Click "Mark all as read" button
3. Should now work without error
4. Unread count should reset to 0
5. All notifications should show as read

## Backend Requirement
Ensure backend has `/notifications/mark-all-read/` endpoint that accepts:
```json
{
  "user_id": "uuid",
  "notification_ids": [1, 2, 3, ...]
}
```

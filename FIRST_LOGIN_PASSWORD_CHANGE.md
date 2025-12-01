# First Login Password Change Implementation

## Overview
This implementation enforces mandatory password change on first login for driver-owner, driver, and owner roles who are given temporary passwords by the system.

## Components Added

### 1. ForcePasswordChangeScreen.js
**Location:** `src/screens/auth/ForcePasswordChangeScreen.js`

A dedicated screen that:
- Displays before users can access the main app
- Requires users to enter a new password and confirm it
- Validates password requirements (minimum 6 characters, different from temporary password)
- Shows clear instructions and requirements
- Handles password change via the existing `changePassword()` function
- Redirects to main app after successful password change

**Features:**
- Password visibility toggle for both fields
- Real-time validation feedback
- Clear error messages
- Password requirements display
- Loading state during submission

### 2. Updated LoginScreen.js
**Changes:**
- Added check for `force_password_change` flag in login response
- If flag is true, redirects to ForcePasswordChangeScreen instead of main app
- Passes user data and temporary password to the password change screen

**Flow:**
```
Login → Check force_password_change flag → 
  If true: Redirect to ForcePasswordChangeScreen
  If false: Proceed to main app
```

### 3. Updated authService.js
**Changes:**
- Modified `loginUser()` function to extract and return `force_password_change` flag
- Checks for both `force_password_change` and `password_change_required` fields from backend
- Includes flag in login response object

### 4. Updated routes.js
**New Constants:**
- `FORCE_PASSWORD_CHANGE` - Route to password change screen
- `MAIN_TABS` - Route to main app tabs
- `VERIFICATION` - Added for consistency

### 5. Updated RootNavigator.js
**Changes:**
- Imported ForcePasswordChangeScreen
- Added screen to navigation stack in unauthenticated section
- Screen is accessible during login flow

## Backend Requirements

Your Django backend should:

1. **Add flag to User model:**
   ```python
   force_password_change = models.BooleanField(default=False)
   ```

2. **Set flag for driver/owner on creation:**
   - When creating driver/owner accounts with temporary passwords, set `force_password_change = True`
   - When tourist creates account with their own password, set `force_password_change = False`

3. **Include flag in login response:**
   ```python
   {
     "success": true,
     "user": {...},
     "session": {...},
     "force_password_change": true,  # Add this
     "message": "Login successful"
   }
   ```

4. **Update flag after password change:**
   - In `changePassword()` endpoint, set `force_password_change = False` after successful password change
   - This prevents the screen from appearing on subsequent logins

## User Flow

### For Driver/Owner (First Login):
1. User logs in with email and temporary password
2. Backend returns `force_password_change: true`
3. App redirects to ForcePasswordChangeScreen
4. User enters new password and confirms it
5. Password is validated and changed
6. User is redirected to main app
7. On subsequent logins, `force_password_change: false` so they go directly to app

### For Tourist:
1. User logs in with email and their own password
2. Backend returns `force_password_change: false`
3. App proceeds directly to main app
4. No password change screen appears

## Password Validation Rules

The ForcePasswordChangeScreen enforces:
- Minimum 6 characters
- Must be different from temporary password
- Must match confirmation field
- Both fields required

## Testing Checklist

- [ ] Driver/owner login with temporary password shows password change screen
- [ ] Tourist login with own password skips password change screen
- [ ] Password validation works correctly
- [ ] Error messages display properly
- [ ] Successful password change redirects to main app
- [ ] Subsequent logins don't show password change screen
- [ ] Back button behavior (should not allow skipping)
- [ ] Loading state displays during submission

## Files Modified

1. `src/screens/auth/ForcePasswordChangeScreen.js` - NEW
2. `src/screens/auth/LoginScreen.js` - MODIFIED
3. `src/services/authService.js` - MODIFIED
4. `src/constants/routes.js` - MODIFIED
5. `src/navigation/RootNavigator.js` - MODIFIED

## Notes

- The temporary password is passed to the password change screen for validation purposes
- The screen prevents users from setting the same password as their temporary one
- After password change, the user is fully authenticated and can access the app
- The implementation is minimal and doesn't require changes to existing authentication flow

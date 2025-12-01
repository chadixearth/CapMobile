# Seamless Role Switching Implementation

## Overview
Implemented seamless role switching for driver-owner users without requiring logout. Users can now switch between driver and owner roles while maintaining their session.

## Key Changes

### 1. **RoleContext** (`src/contexts/RoleContext.js`)
- New context to manage the active role independently from authentication
- Provides `useActiveRole()` hook for accessing and switching roles
- Maintains active role state across the app

### 2. **RootNavigator** (`src/navigation/RootNavigator.js`)
- Integrated `useActiveRole()` hook
- Initializes `activeRole` to 'driver' when user with 'driver-owner' role logs in
- Renders appropriate tab navigator (DriverTabs, OwnerTabs, or MainTabs) based on `activeRole`
- Resets navigation when role changes to ensure clean state
- Exposes `switchActiveRole` globally for MenuScreen access

### 3. **App.js** (`src/App.js`)
- Wrapped RootNavigator with `RoleProvider`
- Ensures RoleContext is available throughout the app

### 4. **MenuScreen** (`src/screens/main/MenuScreen.js`)
- Updated to use `useActiveRole()` hook
- Removed backend role switching call (no logout needed)
- `handleRoleSwitch()` now directly calls `switchActiveRole(newRole)`
- Updated modal message: "Your session will remain active"
- Shows active role with visual indicator in role buttons
- Only shows role switch option if user has multiple roles (availableRoles.length > 1)

## User Flow

### For driver-owner users:
1. **Login** → Defaults to driver screens
2. **Menu** → "Switch Role" option visible
3. **Click Switch Role** → Modal shows available roles
4. **Select Owner** → Instantly switches to owner screens
5. **Session remains active** → No re-login needed

### For single-role users:
- Role switch option hidden (no need to switch)

## Technical Details

### Role Priority
- If user has 'driver-owner' role, defaults to 'driver'
- Can switch to 'owner' seamlessly
- Active role stored in RoleContext state

### Navigation Reset
- When role changes, navigation stack resets to main tab navigator
- Ensures clean state for new role's screens

### State Management
- `auth.role` = User's actual role(s) from backend
- `activeRole` = Currently displayed role
- `displayRole` = activeRole || auth.role (fallback)

## Files Modified
1. `src/contexts/RoleContext.js` - NEW
2. `src/navigation/RootNavigator.js` - UPDATED
3. `src/App.js` - UPDATED
4. `src/screens/main/MenuScreen.js` - UPDATED

## Backward Compatibility
- Existing single-role users unaffected
- Role switch option only appears for multi-role users
- All existing functionality preserved

## Testing Checklist
- [ ] Login as driver-owner user
- [ ] Verify default role is driver
- [ ] Open menu and verify "Switch Role" visible
- [ ] Click switch role and select owner
- [ ] Verify screens change to owner view
- [ ] Verify session remains active (no re-login)
- [ ] Switch back to driver
- [ ] Verify all role-specific features work
- [ ] Test with single-role users (no switch option)

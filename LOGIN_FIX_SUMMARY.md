# Login Issue Fix Summary

## Problem
The mobile app was sending an invalid/expired Authorization token with login requests, causing HTTP 403 errors.

## Root Cause
The `apiRequest` function was adding Authorization headers to login/register requests even though these endpoints should not require authentication.

## Solution
Modified `loginUser` and `registerUser` functions to use direct `fetch` calls instead of `apiRequest` to avoid adding Authorization headers.

## Changes Made

### 1. Fixed loginUser function
- Use direct `fetch` instead of `apiRequest`
- Ensure no Authorization header is sent
- Clear session before login attempt

### 2. Fixed registerUser function  
- Use direct `fetch` instead of `apiRequest`
- Ensure no Authorization header is sent

## Files Modified
- `src/services/authService.js`

## Usage
No changes needed in usage. The login and registration functions work the same way:

```javascript
// Login (unchanged usage)
const result = await loginUser(email, password, allowedRoles);

// Register (unchanged usage)  
const result = await registerUser(email, password, role, additionalData);
```

## Testing
1. Clear app storage/cache
2. Try logging in with valid credentials
3. Should now work without 403 errors
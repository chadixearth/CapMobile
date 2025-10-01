# Mobile App Phone Verification Update

## Current Status: ❌ NOT UPDATED
The mobile app is still using email-based verification. It needs to be updated to match the backend SMS system.

## Required Changes:

### 1. Update Registration Screen
**File**: `src/screens/auth/RegistrationScreen.js`
- Change primary field from email to phone number
- Make email optional/secondary
- Update validation logic
- Update UI labels and placeholders

### 2. Update Auth Service  
**File**: `src/services/authService.js`
- Update registration API calls to prioritize phone
- Handle SMS-based verification flow
- Update login to work with phone or email

### 3. Add Phone Verification Screen
**New File**: `src/screens/auth/PhoneVerificationScreen.js`
- SMS code input screen
- Resend SMS functionality
- Verification logic

### 4. Update Login Screen
**File**: `src/screens/auth/LoginScreen.js`
- Allow login with phone number or email
- Update UI to reflect phone-first approach

## Current Backend SMS Flow:
1. ✅ User registers with phone number (required) + email
2. ✅ Admin approves registration  
3. ✅ SMS sent with email + password to phone
4. ❌ Mobile app still expects email verification

## What Needs to Happen:
1. Update mobile registration to make phone primary field
2. Add SMS verification screen for future use
3. Update login to accept phone or email
4. Test full flow: register → admin approve → receive SMS → login

## Priority: HIGH
The mobile app won't work properly with the new SMS system until these changes are made.
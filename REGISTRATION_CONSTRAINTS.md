# Account Registration Constraints

## Email Constraints
- **Required**: Yes
- **Format**: Valid email format (e.g., user@example.com)
- **Uniqueness**: Must be unique - only 1 account per email
- **Duplicate Handling**: If email already exists, user is prompted to:
  - Try logging in with that email
  - Use "Forgot Password" if they forgot their password
- **Validation**: Frontend regex validation + backend verification

## Password Constraints (Tourist Only)
- **Required**: Yes for tourists, optional for driver/owner
- **Minimum Length**: 6 characters
- **Confirmation**: Must match confirmation password
- **Cannot be**: Empty or whitespace-only
- **For Driver/Owner**: Auto-generated if not provided during registration

## Phone Number Constraints
- **Required**: 
  - Yes for driver and owner roles (for SMS notifications)
  - Yes for tourists if SMS verification method is selected
- **Uniqueness**: Only 1 account per phone number
- **Duplicate Handling**: If phone already exists, user is prompted to:
  - Try logging in if it's their phone
  - Reset password if they forgot it
- **Format**: Phone-pad keyboard (numeric input)
- **No explicit length limit** in frontend

## First Name Constraints
- **Required**: Yes for driver and owner, optional for tourists
- **Auto-capitalization**: Words (first letter of each word capitalized)
- **No explicit length limit**

## Last Name Constraints
- **Required**: Yes for driver and owner, optional for tourists
- **Auto-capitalization**: Words
- **No explicit length limit**

## Driver-Specific Constraints
- **License Number**: 
  - Required
  - Uppercase letters/numbers
  - No explicit length limit
- **Owns Tartanilla**: Boolean (Yes/No)
- **Owned Count**: 
  - Only if owns tartanilla = Yes
  - Range: 0-99 (max 2 digits)
  - Numeric input only

## Owner-Specific Constraints
- **Business Name**: 
  - Required
  - Auto-capitalized (words)
  - No explicit length limit
- **Drives Own Tartanilla**: Boolean (Yes/No)

## Notification Preference (Driver/Owner)
- **Options**: `email`, `sms`, or `both`
- **Default**: `both`
- **Purpose**: How to receive login credentials after admin approval

## Verification Method (Tourist)
- **Options**: `email` or `phone`
- **Default**: `email`
- **Purpose**: How to verify account after registration

## Terms & Conditions
- **Required**: Must be explicitly agreed to before registration
- **Cannot proceed** without acceptance

## Role Validation
- **Valid Roles**: `tourist`, `driver`, `owner`
- **Invalid**: `admin` (web-only, not available for mobile app)

## Registration Status After Submission
- **Tourist**: 
  - `email_verification_required` - if email verification selected
  - `phone_verification_required` - if SMS verification selected
- **Driver/Owner**: 
  - `pending_approval` - requires admin approval before login
  - SMS notification sent to registered phone with credentials

## Email Format Validation
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

## Error Handling
- **Duplicate Email**: 
  - Error Type: `duplicate_email`
  - Message: "This email is already registered."
  - Suggestion: "Try logging in with this email. If you forgot your password, use the 'Forgot Password' option."

- **Duplicate Phone**: 
  - Error Type: `duplicate_phone`
  - Message: "This phone number is already registered."
  - Suggestion: "If this is your phone number, try logging in or reset your password."

## Summary Table

| Field | Tourist | Driver | Owner | Required | Unique | Format |
|-------|---------|--------|-------|----------|--------|--------|
| Email | ✓ | ✓ | ✓ | Yes | Yes | Valid email |
| Password | ✓ | ✗ | ✗ | Yes* | - | Min 6 chars |
| First Name | ✓ | ✓ | ✓ | No** | - | Words |
| Last Name | ✓ | ✓ | ✓ | No** | - | Words |
| Phone | ✗ | ✓ | ✓ | Yes*** | Yes | Numeric |
| License # | - | ✓ | - | Yes | - | Uppercase |
| Business Name | - | - | ✓ | Yes | - | Words |

*Required for tourists, optional for driver/owner
**Required for driver/owner, optional for tourists
***Required for driver/owner, optional for tourists (if SMS verification)

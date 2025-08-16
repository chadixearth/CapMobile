# Registration Flow Testing Guide

This guide helps you test the new role-based registration system where drivers and owners require admin approval.

## Overview

The system now handles different user roles differently:
- **Tourist**: Direct registration with email verification
- **Driver/Owner**: Registration requires admin approval before account creation
- **Admin**: Web-only registration (not available in mobile app)

## Testing Steps

### 1. Test Tourist Registration (Direct Registration)

1. Open the mobile app
2. Navigate to registration screen
3. Select "Tourist" role
4. Fill in email and password
5. Submit registration

**Expected Result:**
- Success message: "Registration successful. Check your email to confirm your account."
- User can check email for verification link
- User can login after email verification

### 2. Test Driver Registration (Pending Approval)

1. Open the mobile app
2. Navigate to registration screen
3. Select "Driver" role
4. Fill in all required fields:
   - Email
   - Password
   - Confirm Password
   - First Name
   - Last Name
   - Phone Number
   - License Number
5. Submit registration

**Expected Result:**
- Success message: "Your driver registration has been submitted for admin approval. You will receive an email confirmation once your account is approved."
- Registration is stored in `pending_registrations` table with status "pending"
- User cannot login until admin approves

### 3. Test Owner Registration (Pending Approval)

1. Open the mobile app
2. Navigate to registration screen
3. Select "Owner" role
4. Fill in all required fields:
   - Email
   - Password
   - Confirm Password
   - First Name
   - Last Name
   - Phone Number
   - Business Name
   - Business Permit Number
5. Submit registration

**Expected Result:**
- Success message: "Your owner registration has been submitted for admin approval. You will receive an email confirmation once your account is approved."
- Registration is stored in `pending_registrations` table with status "pending"
- User cannot login until admin approves

### 4. Test Admin Approval Process

**Prerequisites:** You need admin access to your web interface to test this functionality.

#### Using your Web Admin Interface:

You can also test the admin APIs directly:

**Get Pending Registrations:**
```
GET /api/auth/pending-registrations/
```

**Approve Registration:**
```
POST /api/auth/approve-registration/
Content-Type: application/json

{
    "registration_id": "uuid-here",
    "approved_by": "admin@example.com"
}
```

**Reject Registration:**
```
POST /api/auth/reject-registration/
Content-Type: application/json

{
    "registration_id": "uuid-here",
    "rejected_by": "admin@example.com",
    "reason": "Optional rejection reason"
}
```

### 5. Test Post-Approval Login

After admin approves a driver/owner registration:

1. User should receive email confirmation
2. User can now login with their credentials
3. User's role should be correctly set in the system

## Database Tables to Check

### `pending_registrations` table:
- Contains all driver/owner registrations awaiting approval
- Status can be: "pending", "approved", "rejected"

### `users` table (Supabase Auth):
- Contains approved users only
- Tourist users appear here immediately after email verification
- Driver/Owner users appear here only after admin approval

## Error Cases to Test

1. **Duplicate Email in Pending**: Try registering with same email twice for driver/owner
2. **Duplicate Email Across Systems**: Try registering as driver when email already exists as tourist
3. **Invalid Role**: Try registering with invalid role (should be handled by frontend validation)
4. **Network Errors**: Test with poor network connection
5. **Invalid Registration ID**: Try approving/rejecting with non-existent registration ID

## API Endpoints

The following endpoints are available for the registration system:

- `POST /api/auth/register/` - Universal registration endpoint
- `POST /api/auth/login/` - Universal login endpoint
- `POST /api/auth/admin-login/` - Admin-only login
- `GET /api/auth/pending-registrations/` - Get pending registrations
- `POST /api/auth/approve-registration/` - Approve pending registration
- `POST /api/auth/reject-registration/` - Reject pending registration

## Integration Checklist

- [ ] Tourist registration works with direct email verification
- [ ] Driver registration creates pending record
- [ ] Owner registration creates pending record
- [ ] Admin can view pending registrations
- [ ] Admin can approve registrations (creates user account)
- [ ] Admin can reject registrations
- [ ] Approved users can login successfully
- [ ] Rejected users cannot login
- [ ] Email notifications are sent (if email service is configured)
- [ ] UI shows appropriate messages for each role
- [ ] Error handling works for all edge cases

## Notes

- Make sure your Django backend is running and accessible
- Ensure Supabase configuration is correct
- Email notifications require proper email service configuration in the backend
- The mobile app API base URL should point to your Django server

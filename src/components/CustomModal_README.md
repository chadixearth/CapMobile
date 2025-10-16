# Custom Modal System

This custom modal system replaces the default React Native `Alert.alert` with beautifully styled modals that match your app's design.

## Features

- ✅ **Consistent Design**: Matches your app's color scheme and styling
- ✅ **Multiple Types**: Success, Error, Warning, Info, and Confirmation modals
- ✅ **Smooth Animations**: Fade and scale animations for better UX
- ✅ **Auto-close**: Optional auto-close functionality
- ✅ **Custom Actions**: Support for primary and secondary actions
- ✅ **Icon Support**: Customizable icons with colors
- ✅ **Dark Mode**: Automatic dark/light theme support

## Quick Start

### 1. Import the service
```javascript
import CustomModalService from '../services/CustomModalService';
// OR use the utility wrapper
import { CustomAlert } from '../utils/customAlert';
```

### 2. Replace Alert.alert calls

**Before (Old Way):**
```javascript
Alert.alert('Success', 'Booking accepted successfully!');
```

**After (New Way):**
```javascript
CustomModalService.showSuccess({
  title: 'Booking Accepted!',
  message: 'You have successfully accepted the booking.',
  autoCloseMs: 3000
});
```

## Modal Types

### Success Modal
```javascript
CustomModalService.showSuccess({
  title: 'Success!',
  message: 'Operation completed successfully.',
  primaryActionText: 'Great!',
  autoCloseMs: 3000
});
```

### Error Modal
```javascript
CustomModalService.showError({
  title: 'Error',
  message: 'Something went wrong. Please try again.',
  primaryActionText: 'Retry',
  onPrimaryAction: () => retryOperation()
});
```

### Confirmation Modal
```javascript
CustomModalService.showConfirmation({
  title: 'Delete Item',
  message: 'Are you sure you want to delete this item?',
  primaryActionText: 'Delete',
  secondaryActionText: 'Cancel',
  onPrimaryAction: () => deleteItem(),
  onSecondaryAction: () => console.log('Cancelled')
});
```

### Warning Modal
```javascript
CustomModalService.showWarning({
  title: 'Warning',
  message: 'This action cannot be undone.',
  primaryActionText: 'Continue',
  secondaryActionText: 'Cancel',
  showSecondaryAction: true
});
```

### Info Modal
```javascript
CustomModalService.showInfo({
  title: 'Information',
  message: 'Here is some important information.',
  primaryActionText: 'Got it'
});
```

## Easy Migration with CustomAlert

For easier migration from existing `Alert.alert` calls, use the `CustomAlert` utility:

```javascript
import { CustomAlert } from '../utils/customAlert';

// Simple alert
CustomAlert.alert('Title', 'Message');

// Confirmation
CustomAlert.confirm(
  'Delete Item',
  'Are you sure?',
  () => deleteItem(), // onConfirm
  () => console.log('Cancelled') // onCancel
);

// Quick methods
CustomAlert.success('Success!', 'Operation completed');
CustomAlert.error('Error', 'Something went wrong');
CustomAlert.warning('Warning', 'Please be careful');
```

## Advanced Options

### Custom Icons and Colors
```javascript
CustomModalService.showSuccess({
  title: 'Payment Successful',
  message: 'Your payment has been processed.',
  iconName: 'card', // Any Ionicons name
  iconColor: '#22C55E',
  primaryActionText: 'View Receipt'
});
```

### Auto-close
```javascript
CustomModalService.showSuccess({
  title: 'Saved!',
  message: 'Your changes have been saved.',
  autoCloseMs: 2000 // Auto close after 2 seconds
});
```

### Multiple Actions
```javascript
CustomModalService.showConfirmation({
  title: 'Logout',
  message: 'Are you sure you want to logout?',
  primaryActionText: 'Logout',
  secondaryActionText: 'Cancel',
  onPrimaryAction: () => {
    // Perform logout
    logout();
    // Show success message
    CustomModalService.showSuccess({
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
      autoCloseMs: 2000
    });
  }
});
```

## Common Use Cases

### 1. Booking Actions
```javascript
// Accept booking
CustomModalService.showSuccess({
  title: 'Booking Accepted!',
  message: 'The customer has been notified.',
  autoCloseMs: 3000
});

// Cancel booking confirmation
CustomModalService.showConfirmation({
  title: 'Cancel Booking',
  message: 'Are you sure you want to cancel this booking?',
  primaryActionText: 'Yes, Cancel',
  secondaryActionText: 'Keep Booking',
  onPrimaryAction: () => cancelBooking()
});
```

### 2. Network Errors
```javascript
CustomModalService.showError({
  title: 'Connection Error',
  message: 'Unable to connect. Please check your internet.',
  primaryActionText: 'Retry',
  secondaryActionText: 'Cancel',
  showSecondaryAction: true,
  onPrimaryAction: () => retryRequest()
});
```

### 3. Form Validation
```javascript
CustomModalService.showWarning({
  title: 'Incomplete Form',
  message: 'Please fill in all required fields before submitting.',
  primaryActionText: 'OK'
});
```

### 4. App Updates
```javascript
CustomModalService.showInfo({
  title: 'Update Available',
  message: 'A new version is available with bug fixes.',
  primaryActionText: 'Update Now',
  secondaryActionText: 'Later',
  showSecondaryAction: true,
  onPrimaryAction: () => openAppStore()
});
```

## Migration Checklist

- [ ] Replace all `Alert.alert()` calls
- [ ] Update error handling to use `CustomModalService.showError()`
- [ ] Replace confirmation dialogs with `CustomModalService.showConfirmation()`
- [ ] Add success messages for completed actions
- [ ] Test all modal interactions
- [ ] Verify auto-close functionality where needed

## Tips

1. **Use auto-close for success messages** that don't require user action
2. **Always provide clear action buttons** for confirmations
3. **Use appropriate icons** to make modals more intuitive
4. **Keep messages concise** but informative
5. **Test on both light and dark themes**

The custom modal system is now integrated into your app and ready to use!
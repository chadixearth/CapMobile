// utils/customAlert.js
import CustomModalService from '../services/CustomModalService';

// Custom Alert replacement that uses styled modals instead of system alerts
export const CustomAlert = {
  alert: (title, message, buttons = [], options = {}) => {
    if (!buttons || buttons.length === 0) {
      // Simple alert with just OK button
      CustomModalService.showInfo({
        title: title || 'Alert',
        message: message || '',
        primaryActionText: 'OK',
        ...options
      });
      return;
    }

    if (buttons.length === 1) {
      // Single button alert
      const button = buttons[0];
      CustomModalService.showInfo({
        title: title || 'Alert',
        message: message || '',
        primaryActionText: button.text || 'OK',
        onPrimaryAction: button.onPress,
        ...options
      });
      return;
    }

    if (buttons.length === 2) {
      // Two button alert (confirmation style)
      const [cancelButton, confirmButton] = buttons;
      CustomModalService.showConfirmation({
        title: title || 'Confirm',
        message: message || '',
        secondaryActionText: cancelButton.text || 'Cancel',
        primaryActionText: confirmButton.text || 'OK',
        onSecondaryAction: cancelButton.onPress,
        onPrimaryAction: confirmButton.onPress,
        ...options
      });
      return;
    }

    // Fallback for more than 2 buttons - use first two
    const [cancelButton, confirmButton] = buttons;
    CustomModalService.showConfirmation({
      title: title || 'Confirm',
      message: message || '',
      secondaryActionText: cancelButton.text || 'Cancel',
      primaryActionText: confirmButton.text || 'OK',
      onSecondaryAction: cancelButton.onPress,
      onPrimaryAction: confirmButton.onPress,
      ...options
    });
  },

  // Convenience methods
  success: (title, message, onPress) => {
    CustomModalService.showSuccess({
      title: title || 'Success!',
      message: message || 'Operation completed successfully.',
      onPrimaryAction: onPress
    });
  },

  error: (title, message, onPress) => {
    CustomModalService.showError({
      title: title || 'Error',
      message: message || 'Something went wrong. Please try again.',
      onPrimaryAction: onPress
    });
  },

  confirm: (title, message, onConfirm, onCancel) => {
    CustomModalService.showConfirmation({
      title: title || 'Confirm Action',
      message: message || 'Are you sure you want to continue?',
      onPrimaryAction: onConfirm,
      onSecondaryAction: onCancel
    });
  },

  warning: (title, message, onPress) => {
    CustomModalService.showWarning({
      title: title || 'Warning',
      message: message || 'Please review this information carefully.',
      onPrimaryAction: onPress
    });
  }
};

export default CustomAlert;
// services/CustomModalService.js
import React from 'react';

class CustomModalService {
  constructor() {
    this.modalRef = null;
  }

  setModalRef(ref) {
    this.modalRef = ref;
  }

  showSuccess(options = {}) {
    if (!this.modalRef) return;
    this.modalRef.showModal({
      type: 'success',
      title: options.title || 'Success!',
      message: options.message || 'Operation completed successfully.',
      iconName: 'checkmark-circle',
      iconColor: '#22C55E',
      primaryActionText: options.primaryActionText || 'OK',
      onPrimaryAction: options.onPrimaryAction,
      onSecondaryAction: options.onSecondaryAction,
      secondaryActionText: options.secondaryActionText,
      autoCloseMs: options.autoCloseMs,
      ...options
    });
  }

  showError(options = {}) {
    if (!this.modalRef) return;
    this.modalRef.showModal({
      type: 'error',
      title: options.title || 'Error',
      message: options.message || 'Something went wrong. Please try again.',
      iconName: 'close-circle',
      iconColor: '#EF4444',
      primaryActionText: options.primaryActionText || 'OK',
      onPrimaryAction: options.onPrimaryAction,
      onSecondaryAction: options.onSecondaryAction,
      secondaryActionText: options.secondaryActionText,
      ...options
    });
  }

  showConfirmation(options = {}) {
    if (!this.modalRef) return;
    this.modalRef.showModal({
      type: 'confirmation',
      title: options.title || 'Confirm Action',
      message: options.message || 'Are you sure you want to continue?',
      iconName: 'help-circle',
      iconColor: '#F59E0B',
      primaryActionText: options.primaryActionText || 'Confirm',
      secondaryActionText: options.secondaryActionText || 'Cancel',
      onPrimaryAction: options.onPrimaryAction,
      onSecondaryAction: options.onSecondaryAction,
      showSecondaryAction: true,
      ...options
    });
  }

  showInfo(options = {}) {
    if (!this.modalRef) return;
    this.modalRef.showModal({
      type: 'info',
      title: options.title || 'Information',
      message: options.message || 'Here is some important information.',
      iconName: 'information-circle',
      iconColor: '#3B82F6',
      primaryActionText: options.primaryActionText || 'OK',
      onPrimaryAction: options.onPrimaryAction,
      onSecondaryAction: options.onSecondaryAction,
      secondaryActionText: options.secondaryActionText,
      ...options
    });
  }

  showWarning(options = {}) {
    if (!this.modalRef) return;
    this.modalRef.showModal({
      type: 'warning',
      title: options.title || 'Warning',
      message: options.message || 'Please review this information carefully.',
      iconName: 'warning',
      iconColor: '#F59E0B',
      primaryActionText: options.primaryActionText || 'OK',
      onPrimaryAction: options.onPrimaryAction,
      onSecondaryAction: options.onSecondaryAction,
      secondaryActionText: options.secondaryActionText,
      ...options
    });
  }

  hide() {
    if (!this.modalRef) return;
    this.modalRef.hideModal();
  }
}

export default new CustomModalService();
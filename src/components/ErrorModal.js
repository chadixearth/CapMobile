import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, card } from '../styles/global';
import ModalManager from '../services/ModalManager';

const { width } = Dimensions.get('window');

const ErrorModal = ({
  visible,
  onClose,
  title = 'Error',
  message,
  primaryButtonText = 'OK',
  secondaryButtonText = null,
  onPrimaryPress = null,
  onSecondaryPress = null,
  type = 'error', // 'error', 'warning', 'info', 'success'
  autoClose = false,
  autoCloseDelay = 3000,
}) => {
  // Register with modal manager for auto-close on session expiry
  useEffect(() => {
    if (visible && onClose) {
      return ModalManager.registerModal(onClose);
    }
  }, [visible, onClose]);
  React.useEffect(() => {
    if (visible && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, autoCloseDelay, onClose]);

  const getIconAndColors = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle',
          iconColor: '#059669',
          backgroundColor: '#F0FDF4',
          borderColor: '#BBF7D0',
        };
      case 'warning':
        return {
          icon: 'warning',
          iconColor: '#D97706',
          backgroundColor: '#FFFBEB',
          borderColor: '#FED7AA',
        };
      case 'info':
        return {
          icon: 'information-circle',
          iconColor: '#0284C7',
          backgroundColor: '#F0F9FF',
          borderColor: '#BAE6FD',
        };
      default: // error
        return {
          icon: 'alert-circle',
          iconColor: '#DC2626',
          backgroundColor: '#FEF2F2',
          borderColor: '#FECACA',
        };
    }
  };

  const { icon, iconColor, backgroundColor, borderColor } = getIconAndColors();

  const handlePrimaryPress = () => {
    if (onPrimaryPress) {
      onPrimaryPress();
    } else {
      onClose();
    }
  };

  const handleSecondaryPress = () => {
    if (onSecondaryPress) {
      onSecondaryPress();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={60} color={iconColor} />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            {secondaryButtonText && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleSecondaryPress}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                secondaryButtonText ? styles.buttonHalfWidth : styles.buttonFullWidth
              ]}
              onPress={handlePrimaryPress}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    width: width * 0.9,
    maxWidth: 500,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFullWidth: {
    flex: 1,
  },
  buttonHalfWidth: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#6B2E2B',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6B2E2B',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6B2E2B',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ErrorModal;

import React, { createContext, useContext, useRef, useState } from 'react';
import ErrorModal from './ErrorModal';
import ErrorHandlingService from '../services/errorHandlingService';

const ErrorContext = createContext();

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

const ErrorProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    visible: false,
    type: 'error',
    title: 'Error',
    message: '',
    primaryButtonText: 'OK',
    secondaryButtonText: null,
    onPrimaryPress: null,
    onSecondaryPress: null,
    autoClose: false,
    autoCloseDelay: 3000,
  });

  const errorModalRef = useRef({
    show: (config) => {
      setModalState({
        visible: true,
        type: config.type || 'error',
        title: config.title || 'Error',
        message: config.message || '',
        primaryButtonText: config.primaryButtonText || 'OK',
        secondaryButtonText: config.secondaryButtonText || null,
        onPrimaryPress: config.onPrimaryPress || null,
        onSecondaryPress: config.onSecondaryPress || null,
        autoClose: config.autoClose || false,
        autoCloseDelay: config.autoCloseDelay || 3000,
      });
    },
    hide: () => {
      setModalState(prev => ({ ...prev, visible: false }));
    },
  });

  // Set the error modal reference in the service
  React.useEffect(() => {
    ErrorHandlingService.setErrorModalRef(errorModalRef.current);
  }, []);

  const closeModal = () => {
    setModalState(prev => ({ ...prev, visible: false }));
  };

  const showError = (message, options = {}) => {
    errorModalRef.current.show({
      type: 'error',
      title: options.title || 'Error',
      message,
      ...options,
    });
  };

  const showSuccess = (message, options = {}) => {
    errorModalRef.current.show({
      type: 'success',
      title: options.title || 'Success',
      message,
      autoClose: true,
      autoCloseDelay: 3000,
      ...options,
    });
  };

  const showWarning = (message, options = {}) => {
    errorModalRef.current.show({
      type: 'warning',
      title: options.title || 'Warning',
      message,
      ...options,
    });
  };

  const showInfo = (message, options = {}) => {
    errorModalRef.current.show({
      type: 'info',
      title: options.title || 'Information',
      message,
      ...options,
    });
  };

  const contextValue = {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    errorModalRef: errorModalRef.current,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      <ErrorModal
        visible={modalState.visible}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        primaryButtonText={modalState.primaryButtonText}
        secondaryButtonText={modalState.secondaryButtonText}
        onPrimaryPress={modalState.onPrimaryPress}
        onSecondaryPress={modalState.onSecondaryPress}
        autoClose={modalState.autoClose}
        autoCloseDelay={modalState.autoCloseDelay}
      />
    </ErrorContext.Provider>
  );
};

export default ErrorProvider;
import React, { useEffect, useState } from 'react';
import SuccessModal from './SuccessModal';
import ErrorModal from './ErrorModal';
import ConfirmationModal from './ConfirmationModal';
import { popupTracker } from '../services/popupTracker';

const OneTimeModal = ({
  popupId,
  modalType = 'success',
  visible: externalVisible,
  onClose,
  ...modalProps
}) => {
  const [internalVisible, setInternalVisible] = useState(false);

  useEffect(() => {
    const checkAndShow = async () => {
      if (externalVisible && popupId) {
        const hasShown = await popupTracker.hasShown(popupId);
        if (!hasShown) {
          setInternalVisible(true);
        }
      } else {
        setInternalVisible(false);
      }
    };
    checkAndShow();
  }, [externalVisible, popupId]);

  const handleClose = async () => {
    if (popupId) {
      await popupTracker.markAsShown(popupId);
    }
    setInternalVisible(false);
    onClose?.();
  };

  const ModalComponent = 
    modalType === 'error' ? ErrorModal :
    modalType === 'confirmation' ? ConfirmationModal :
    SuccessModal;

  return (
    <ModalComponent
      {...modalProps}
      visible={internalVisible}
      onClose={handleClose}
    />
  );
};

export default OneTimeModal;

// Global modal manager to handle auto-closing modals on session expiry
class ModalManager {
  constructor() {
    this.modals = new Set();
  }

  registerModal(closeFunction) {
    this.modals.add(closeFunction);
    return () => this.modals.delete(closeFunction);
  }

  closeAllModals() {
    console.log('[ModalManager] Closing all modals due to session expiry');
    this.modals.forEach(closeFunction => {
      try {
        closeFunction();
      } catch (error) {
        console.warn('[ModalManager] Error closing modal:', error);
      }
    });
  }
}

export default new ModalManager();
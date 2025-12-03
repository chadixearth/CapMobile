import AsyncStorage from '@react-native-async-storage/async-storage';

const POPUP_STORAGE_KEY = '@popup_shown_';

export const popupTracker = {
  async hasShown(popupId) {
    try {
      const value = await AsyncStorage.getItem(POPUP_STORAGE_KEY + popupId);
      return value === 'true';
    } catch {
      return false;
    }
  },

  async markAsShown(popupId) {
    try {
      await AsyncStorage.setItem(POPUP_STORAGE_KEY + popupId, 'true');
    } catch (error) {
      console.error('Failed to mark popup as shown:', error);
    }
  },

  async reset(popupId) {
    try {
      await AsyncStorage.removeItem(POPUP_STORAGE_KEY + popupId);
    } catch (error) {
      console.error('Failed to reset popup:', error);
    }
  },

  async resetAll() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const popupKeys = keys.filter(key => key.startsWith(POPUP_STORAGE_KEY));
      await AsyncStorage.multiRemove(popupKeys);
    } catch (error) {
      console.error('Failed to reset all popups:', error);
    }
  }
};

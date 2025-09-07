import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKIE_STORAGE_KEY = 'app_cookies';

/**
 * Stores cookies from a Set-Cookie header.
 * @param {string} setCookieHeader - The value of the 'Set-Cookie' header.
 */
export const storeCookies = async (setCookieHeader) => {
  if (!setCookieHeader) {
    return;
  }

  try {
    const existingCookies = await getCookies();
    const newCookies = setCookieHeader.split(', ');

    newCookies.forEach(cookieString => {
      const [cookiePair] = cookieString.split(';');
      const [name, value] = cookiePair.split('=');
      if (name && value) {
        existingCookies[name.trim()] = value.trim();
      }
    });

    await AsyncStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(existingCookies));
  } catch (error) {
    console.error('Error storing cookies:', error);
  }
};

/**
 * Gets all stored cookies as an object.
 * @returns {Promise<Object>} - An object of cookies.
 */
export const getCookies = async () => {
  try {
    const cookiesString = await AsyncStorage.getItem(COOKIE_STORAGE_KEY);
    return cookiesString ? JSON.parse(cookiesString) : {};
  } catch (error) {
    console.error('Error getting cookies:', error);
    return {};
  }
};

/**
 * Gets cookies as a string for use in a 'Cookie' header.
 * @returns {Promise<string>} - A string of cookies.
 */
export const getCookieHeader = async () => {
  const cookies = await getCookies();
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
};

/**
 * Clears all stored cookies.
 */
export const clearCookies = async () => {
  try {
    await AsyncStorage.removeItem(COOKIE_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing cookies:', error);
  }
};

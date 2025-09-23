/**
 * Profile utilities for consistent profile photo handling across the app
 */

/**
 * Get profile photo URL from various possible field names
 * @param {Object} userData - User data object
 * @returns {string|null} - Profile photo URL or null
 */
export const getProfilePhotoUrl = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return null;
  }

  // Check all possible field names for profile photo
  const possibleFields = [
    'profile_photo',
    'profile_photo_url', 
    'avatar_url',
    'photo_url',
    'profilePhoto',
    'profilePhotoUrl',
    'avatarUrl',
    'photoUrl'
  ];

  for (const field of possibleFields) {
    const url = userData[field];
    if (url && typeof url === 'string' && url.trim() !== '') {
      return url.trim();
    }
  }

  return null;
};

/**
 * Get user display name from various possible field combinations
 * @param {Object} userData - User data object
 * @returns {string} - Display name
 */
export const getUserDisplayName = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return 'User';
  }

  // Try direct name fields first
  if (userData.name && userData.name.trim()) {
    return userData.name.trim();
  }

  if (userData.full_name && userData.full_name.trim()) {
    return userData.full_name.trim();
  }

  // Try first/middle/last name combination
  const first = userData.first_name || userData.firstName || '';
  const middle = userData.middle_name || userData.middleName || '';
  const last = userData.last_name || userData.lastName || '';
  
  const combined = [first, middle, last]
    .filter(name => name && name.trim())
    .join(' ')
    .trim();
  
  if (combined) {
    return combined;
  }

  // Try email as fallback
  if (userData.email && userData.email.trim()) {
    return userData.email.trim();
  }

  // Final fallback
  const role = userData.role || userData.userRole || 'User';
  const id = userData.id || userData.user_id || '';
  return `${role} ${id.slice(0, 8)}`;
};

/**
 * Standardize user profile data with consistent field names
 * @param {Object} userData - Raw user data
 * @returns {Object} - Standardized user profile
 */
export const standardizeUserProfile = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return {
      id: null,
      name: 'User',
      email: '',
      role: 'user',
      phone: '',
      profile_photo: null,
      profile_photo_url: null,
      avatar_url: null
    };
  }

  const profilePhoto = getProfilePhotoUrl(userData);
  const displayName = getUserDisplayName(userData);

  return {
    id: userData.id || userData.user_id || null,
    name: displayName,
    email: userData.email || '',
    role: userData.role || userData.userRole || 'user',
    phone: userData.phone || userData.phoneNumber || '',
    profile_photo: profilePhoto,
    profile_photo_url: profilePhoto,
    avatar_url: profilePhoto,
    // Keep original fields for backward compatibility
    ...userData
  };
};

/**
 * Generate avatar initials from name
 * @param {string} name - User name
 * @returns {string} - Avatar initials (1-2 characters)
 */
export const getAvatarInitials = (name) => {
  if (!name || typeof name !== 'string') {
    return 'U';
  }

  const cleanName = name.trim();
  if (!cleanName) {
    return 'U';
  }

  const words = cleanName.split(' ').filter(word => word.length > 0);
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  } else if (words.length >= 2) {
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }
  
  return cleanName.charAt(0).toUpperCase();
};

/**
 * Create a fallback avatar URL using ui-avatars.com
 * @param {string} name - User name
 * @param {string} backgroundColor - Background color (hex without #)
 * @param {string} textColor - Text color (hex without #)
 * @param {number} size - Avatar size in pixels
 * @returns {string} - Avatar URL
 */
export const getFallbackAvatarUrl = (name, backgroundColor = '6B2E2B', textColor = 'fff', size = 128) => {
  const displayName = name || 'User';
  const encodedName = encodeURIComponent(displayName);
  return `https://ui-avatars.com/api/?name=${encodedName}&background=${backgroundColor}&color=${textColor}&size=${size}`;
};

/**
 * Get the best available avatar URL (profile photo or fallback)
 * @param {Object} userData - User data object
 * @param {Object} options - Options for fallback avatar
 * @returns {string} - Avatar URL
 */
export const getBestAvatarUrl = (userData, options = {}) => {
  const profilePhoto = getProfilePhotoUrl(userData);
  
  if (profilePhoto) {
    return profilePhoto;
  }

  const displayName = getUserDisplayName(userData);
  const { backgroundColor = '6B2E2B', textColor = 'fff', size = 128 } = options;
  
  return getFallbackAvatarUrl(displayName, backgroundColor, textColor, size);
};
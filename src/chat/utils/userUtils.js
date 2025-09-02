import { getCurrentUser as getAuthUser, getUserProfile } from '../../services/authService';

/**
 * Get the currently authenticated user
 * @returns {Promise<Object|null>} The current user object or null if not authenticated
 */
export const getCurrentUser = async () => {
  try {
    // Use your existing auth service
    const user = await getAuthUser();
    
    if (!user) {
      console.log('No authenticated user found');
      return null;
    }
    
    return user;
  } catch (err) {
    console.error('Error getting current user:', err.message);
    return null;
  }
};

// /**
//  * Get display name for user
//  * @param {Object} user - User object 
//  * @returns {string} Display name
//  */
// export const getDisplayName = (user) => {
//   if (!user) return 'Guest';
  
//   // Try to get name from profile or email
//   return user.name || 
//          user.first_name || 
//          (user.email ? user.email.split('@')[0] : 
//          `User-${user.id?.substring(0,6) || 'unknown'}`);
// };

/**
 * Get user profile with additional details
 */
// export const getUserFullProfile = async (userId) => {
//   try {
//     if (!userId) return null;
    
//     // Use your existing profile API
//     const { success, data } = await getUserProfile(userId);
    
//     if (!success || !data) {
//       console.log('Failed to get user profile');
//       return null;
//     }
    
//     return data;
//   } catch (err) {
//     console.error('Error getting user profile:', err.message);
//     return null;
//   }
// };
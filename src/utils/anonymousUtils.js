/**
 * Utility functions for handling anonymous reviews
 */

/**
 * Masks a name for anonymous display
 * Shows first and last character with asterisks in between
 * @param {string} name - The name to mask
 * @returns {string} - The masked name (e.g., "John" -> "J**n")
 */
export function maskName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return 'Anonymous';
  }
  
  const trimmedName = name.trim();
  
  // If name is too short, just return asterisks
  if (trimmedName.length <= 2) {
    return '*'.repeat(trimmedName.length);
  }
  
  // For names longer than 2 characters, show first and last with asterisks in between
  const firstChar = trimmedName.charAt(0);
  const lastChar = trimmedName.charAt(trimmedName.length - 1);
  const middleLength = Math.max(1, trimmedName.length - 2);
  const asterisks = '*'.repeat(middleLength);
  
  return `${firstChar}${asterisks}${lastChar}`;
}

/**
 * Gets the display name for a review based on anonymity setting
 * @param {Object} review - The review object
 * @param {string} review.reviewer_name - The reviewer's name
 * @param {boolean} review.is_anonymous - Whether the review is anonymous
 * @returns {string} - The display name
 */
export function getReviewDisplayName(review) {
  if (!review) return 'Anonymous';
  
  // Backend hides reviewer identity from other users, so we need to handle this
  // If users object exists, use that name (when viewing own review)
  // If users is null but reviewer_name is "Customer", we need the actual name for proper masking
  
  if (review.is_anonymous === true) {
    // For anonymous reviews, we need the actual name to mask properly
    if (review.users?.name) {
      // Viewing own review - use actual name
      return maskName(review.users.name);
    } else {
      // Viewing someone else's review - backend hides name, so use generic mask
      return 'A*******s'; // Generic anonymous display
    }
  }
  
  // Not anonymous - show name if available, otherwise show "Customer"
  return review.users?.name || review.reviewer_name || 'Customer';
}
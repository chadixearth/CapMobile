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
  
  if (review.is_anonymous) {
    // If backend returns generic anonymous names, just show 'Anonymous'
    if (!review.reviewer_name || 
        review.reviewer_name === 'Anonymous Tourist' || 
        review.reviewer_name === 'Anonymous' ||
        review.reviewer_name === 'Customer') {
      return 'Anonymous';
    }
    return maskName(review.reviewer_name);
  }
  
  return review.reviewer_name || 'Customer';
}
/**
 * Format a date as time (HH:MM AM/PM)
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted time string
 */
export const formatMessageTime = (dateInput) => {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

/**
 * Format a date as a short date (MM/DD/YYYY)
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string
 */
export const formatShortDate = (dateInput) => {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  return date.toLocaleDateString();
};

/**
 * Format a date as a full date with time
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date and time string
 */
export const formatFullDateTime = (dateInput) => {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  return `${date.toLocaleDateString()} ${formatMessageTime(date)}`;
};

/**
 * Check if the given date is today
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {boolean} True if date is today
 */
export const isToday = (dateInput) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const today = new Date();
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

/**
 * Get a smart formatted date string
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string (Today at 2:30 PM, Yesterday at 3:45 PM, or MM/DD/YYYY)
 */
export const getSmartDate = (dateInput) => {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if date is today
  if (isToday(date)) {
    return `Today at ${formatMessageTime(date)}`;
  }
  
  // Check if date is yesterday
  if (date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()) {
    return `Yesterday at ${formatMessageTime(date)}`;
  }
  
  // Otherwise return the date
  return formatFullDateTime(date);
};

/**
 * Get a relative time string
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Relative time (e.g., "just now", "5 minutes ago", "2 hours ago")
 */
export const getRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  } else {
    return formatShortDate(date);
  }
};
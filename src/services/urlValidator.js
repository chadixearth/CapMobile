// URL Validator for API requests
// Ensures all requests go to the configured backend only

import { apiBaseUrl } from './networkConfig';

const ALLOWED_BASE_URL = apiBaseUrl();

export function validateApiUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Must start with our configured API base URL
  return url.startsWith(ALLOWED_BASE_URL);
}

export function buildApiUrl(path) {
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${ALLOWED_BASE_URL}${cleanPath}`;
}

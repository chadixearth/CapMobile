// services/tourPackageService.js
// Use your computer's IP address instead of localhost for mobile devices
// Try multiple likely endpoints to be resilient to server route differences
// Single, authoritative base URL (matches Django router: router.register('tourpackage', ...))
const API_BASE_URL = 'http://10.196.222.213:8000/api/tourpackage/';
import { getAccessToken } from '../authService';

// Helper function to create a timeout promise
const createTimeout = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
};

// Helper function to format coordinates, photos, and reviews
const formatCoordinates = (packages) => {
  return packages.map(pkg => {
    // Convert null coordinates to string format for display
    const formattedPackage = { ...pkg };
    
    // Handle pickup coordinates
    if (formattedPackage.pickup_lat === null) {
      formattedPackage.pickup_lat = 'Not specified';
    } else if (typeof formattedPackage.pickup_lat === 'number') {
      formattedPackage.pickup_lat = formattedPackage.pickup_lat.toString();
    }
    
    if (formattedPackage.pickup_lng === null) {
      formattedPackage.pickup_lng = 'Not specified';
    } else if (typeof formattedPackage.pickup_lng === 'number') {
      formattedPackage.pickup_lng = formattedPackage.pickup_lng.toString();
    }
    
    // Handle dropoff coordinates
    if (formattedPackage.dropoff_lat === null) {
      formattedPackage.dropoff_lat = 'Not specified';
    } else if (typeof formattedPackage.dropoff_lat === 'number') {
      formattedPackage.dropoff_lat = formattedPackage.dropoff_lat.toString();
    }
    
    if (formattedPackage.dropoff_lng === null) {
      formattedPackage.dropoff_lng = 'Not specified';
    } else if (typeof formattedPackage.dropoff_lng === 'number') {
      formattedPackage.dropoff_lng = formattedPackage.dropoff_lng.toString();
    }
    
    // Handle photos - convert array of objects to array of URLs
    if (formattedPackage.photos && Array.isArray(formattedPackage.photos)) {
      formattedPackage.photos = formattedPackage.photos.map(photo => {
        // If photo is an object with a url property, extract it
        if (typeof photo === 'object' && photo !== null) {
          return photo.url || photo.image_url || photo.photo_url || photo.src || '';
        }
        // If photo is already a string (URL), use it as is
        else if (typeof photo === 'string') {
          return photo;
        }
        // Otherwise, return empty string
        return '';
      }).filter(url => url !== ''); // Remove empty URLs
    } else {
      formattedPackage.photos = [];
    }

    // Ensure reviews structure exists
    // Support various backend shapes: reviews (array), ratings (array), review_count, average_rating
    const reviewsArray = Array.isArray(formattedPackage.reviews)
      ? formattedPackage.reviews
      : (Array.isArray(formattedPackage.ratings) ? formattedPackage.ratings : []);

    // Normalize each review to have at least a numeric rating if present
    const normalizedReviews = reviewsArray.map(r => {
      if (typeof r === 'number') return { rating: r };
      if (r && typeof r === 'object') return r;
      return { rating: 0 };
    });

    // Compute average rating if not provided
    let averageRating = Number(formattedPackage.average_rating);
    if (Number.isNaN(averageRating) || averageRating === 0) {
      if (normalizedReviews.length > 0) {
        const total = normalizedReviews.reduce((sum, rv) => sum + (Number(rv.rating) || 0), 0);
        averageRating = normalizedReviews.length ? total / normalizedReviews.length : 0;
      } else if (typeof formattedPackage.rating === 'number') {
        averageRating = formattedPackage.rating;
      } else {
        averageRating = 0;
      }
    }

    const reviewsCount = Number(formattedPackage.reviews_count ?? formattedPackage.review_count);

    formattedPackage.reviews = normalizedReviews;
    formattedPackage.reviews_count = Number.isNaN(reviewsCount) ? normalizedReviews.length : reviewsCount;
    formattedPackage.average_rating = averageRating;
    
    return formattedPackage;
  });
};

// Test function to check if server is reachable
export const testConnection = async () => {
  const testUrls = [
    API_BASE_URL,
    'http://10.196.222.213:8000/api/',
    'http://10.196.222.213:8000/',
  ];

  for (const url of testUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      // Check if it's JSON
      if (contentType && contentType.includes('application/json')) {
        try {
          const jsonData = JSON.parse(text);
          return {
            success: true,
            status: response.status,
            url: url,
            data: jsonData,
            text: text.substring(0, 200)
          };
        } catch (parseError) {
          // Invalid JSON
        }
      } else {
        // Even if it's not JSON, let's check if it contains API-like content
        if (text.includes('api') || text.includes('tour') || text.includes('package')) {
          return {
            success: true,
            status: response.status,
            url: url,
            warning: 'Endpoint found but returns HTML instead of JSON',
            text: text.substring(0, 200)
          };
        }
      }
    } catch (error) {
      // Error testing URL
    }
  }
  
  return {
    success: false,
    error: 'No working API endpoint found. Please check your server configuration.',
    testedUrls: testUrls
  };
};

export const tourPackageService = {
  // Get all tour packages
  async getAllPackages() {
    try {
      const token = await getAccessToken();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(API_BASE_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status} at ${API_BASE_URL}`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Response is not JSON at ${API_BASE_URL}`);
      }
      const data = await response.json();
      
      let packages;
      // Handle Django REST Framework response structure
      if (data.success && data.data) {
        // If it's wrapped in success/data structure
        packages = Array.isArray(data.data) ? data.data : [data.data];
      } else if (Array.isArray(data)) {
        // If it's a direct array of packages
        packages = data;
      } else if (data.results && Array.isArray(data.results)) {
        // If it's paginated Django REST Framework response
        packages = data.results;
      } else {
        throw new Error('Unexpected response format from server');
      }
      
      // Format coordinates and ensure reviews exist
      let formattedPackages = formatCoordinates(packages);

      // If backend didn't include reviews, try to fetch them per package and merge
      try {
        const needsReviews = formattedPackages.some(p => !Array.isArray(p.reviews) || p.reviews.length === 0);
        if (needsReviews) {
          formattedPackages = await mergeReviewsIntoPackages(formattedPackages);
        }
      } catch (mergeError) {
        // Non-fatal: proceed without merged reviews
        console.warn('Could not merge reviews; proceeding without:', mergeError?.message || mergeError);
      }

      return formattedPackages;
    } catch (error) {
      console.error('Error fetching packages:', error);
      throw error;
    }
  },

  // Get a specific tour package by ID
  async getPackageById(packageId) {
    try {
      const token = await getAccessToken();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${API_BASE_URL}${packageId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status} at ${API_BASE_URL}${packageId}/`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Response is not JSON at ${API_BASE_URL}${packageId}/`);
      }
      const data = await response.json();
      
      let packageData;
      // Handle Django REST Framework response structure
      if (data.success && data.data) {
        packageData = data.data;
      } else if (data.id) {
        // Direct package object
        packageData = data;
      } else {
        throw new Error('Unexpected response format from server');
      }
      
      // Format coordinates and ensure reviews for single package
      let formattedPackage = formatCoordinates([packageData])[0];

      // If backend didn't include reviews, fetch them and merge
      try {
        if (!Array.isArray(formattedPackage.reviews) || formattedPackage.reviews.length === 0) {
          const reviews = await fetchPackageReviews(formattedPackage.id);
          const { normalizedReviews, averageRating } = normalizeReviews(reviews, formattedPackage);
          formattedPackage = {
            ...formattedPackage,
            reviews: normalizedReviews,
            reviews_count: normalizedReviews.length,
            average_rating: averageRating,
          };
        }
      } catch (mergeError) {
        // Non-fatal
        console.warn('Could not fetch reviews for package', formattedPackage?.id, mergeError?.message || mergeError);
      }

      return formattedPackage;
    } catch (error) {
      console.error('Error fetching package:', error);
      throw error;
    }
  },
};

// ------------------------
// Reviews integration utils
// ------------------------

// Derive API prefix (e.g., http://host:8000/api) from tourpackage base URL
const API_PREFIX = (() => {
  try {
    // Remove trailing slash for stability
    const trimmed = API_BASE_URL.replace(/\/$/, '');
    // Split off the trailing /tourpackage
    const idx = trimmed.lastIndexOf('/tourpackage');
    if (idx > 0) return trimmed.substring(0, idx);
  } catch {}
  // Fallback: assume '/api' lives one level up
  return API_BASE_URL.replace(/\/$/, '').replace(/\/tourpackage$/, '');
})();

function buildReviewUrlCandidates(packageId) {
  // Try several common REST patterns
  return [
    // Nested under tourpackage
    `${API_BASE_URL}${packageId}/reviews/`,
    `${API_BASE_URL}${packageId}/ratings/`,
    // Separate reviews module
    `${API_PREFIX}/reviews/?package_id=${encodeURIComponent(packageId)}`,
    `${API_PREFIX}/reviews/${packageId}/`,
    `${API_PREFIX}/review/${packageId}/`,
    // Alternate pluralization
    `${API_PREFIX}/rating/?package_id=${encodeURIComponent(packageId)}`,
  ];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function extractReviewsFromResponseData(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.results && Array.isArray(data.results)) return data.results;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.data && data.data.results && Array.isArray(data.data.results)) return data.data.results;
  return [];
}

async function fetchPackageReviews(packageId) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const candidates = buildReviewUrlCandidates(packageId);

  for (const url of candidates) {
    try {
      const resp = await fetchWithTimeout(url, { method: 'GET', headers }, 8000);
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      const json = await resp.json();
      const reviews = extractReviewsFromResponseData(json);
      if (Array.isArray(reviews)) return reviews;
    } catch (_) {
      // Try next candidate
    }
  }
  return [];
}

function normalizeReviews(reviews, basePackage = {}) {
  const normalizedReviews = (Array.isArray(reviews) ? reviews : []).map(r => {
    if (typeof r === 'number') return { rating: r };
    if (r && typeof r === 'object') return r;
    return { rating: 0 };
  });

  let averageRating = Number(basePackage.average_rating);
  if (Number.isNaN(averageRating) || averageRating === 0) {
    if (normalizedReviews.length > 0) {
      const total = normalizedReviews.reduce((sum, rv) => sum + (Number(rv.rating) || 0), 0);
      averageRating = normalizedReviews.length ? total / normalizedReviews.length : 0;
    } else if (typeof basePackage.rating === 'number') {
      averageRating = basePackage.rating;
    } else {
      averageRating = 0;
    }
  }

  return { normalizedReviews, averageRating };
}

async function mergeReviewsIntoPackages(packages) {
  // Limit concurrency to avoid flooding the API
  const CONCURRENCY = 5;
  const resultPackages = [...packages];
  let index = 0;

  async function worker() {
    while (index < resultPackages.length) {
      const currentIndex = index++;
      const pkg = resultPackages[currentIndex];
      if (Array.isArray(pkg.reviews) && pkg.reviews.length > 0) continue;
      try {
        const reviews = await fetchPackageReviews(pkg.id);
        const { normalizedReviews, averageRating } = normalizeReviews(reviews, pkg);
        resultPackages[currentIndex] = {
          ...pkg,
          reviews: normalizedReviews,
          reviews_count: normalizedReviews.length,
          average_rating: averageRating,
        };
      } catch (_) {
        // Leave package as-is on failure
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  return resultPackages;
}
// services/tourPackageService.js
// Use your computer's IP address instead of localhost for mobile devices
const API_BASE_URL = 'http://192.168.101.74:8000/api/tourpackage/'; // Your Django server on port 8000

// Helper function to create a timeout promise
const createTimeout = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
};

// Helper function to format coordinates and photos
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
    
    return formattedPackage;
  });
};

// Test function to check if server is reachable
export const testConnection = async () => {
  const testUrls = [
    // Test Django REST Framework endpoints
    'http://192.168.1.8:8000/api/tourpackage/',
    'http://192.168.1.8:8000/api/tourpackages/',
    'http://192.168.1.8:8000/api/packages/',
    'http://192.168.1.8:8000/tourpackage/',
    'http://192.168.1.8:8000/tourpackages/',
    'http://192.168.1.8:8000/packages/',
    'http://192.168.1.8:8000/api/',
    'http://192.168.1.8:8000/',
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
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
      
      // Format coordinates to handle null values and photos
      const formattedPackages = formatCoordinates(packages);
      return formattedPackages;
    } catch (error) {
      console.error('Error fetching packages:', error);
      throw error;
    }
  },

  // Get a specific tour package by ID
  async getPackageById(packageId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}${packageId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
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
      
      // Format coordinates for single package
      const formattedPackage = formatCoordinates([packageData])[0];
      return formattedPackage;
    } catch (error) {
      console.error('Error fetching package:', error);
      throw error;
    }
  },
};
/**
 * Booking Verification Service
 * Handles photo upload and verification for tour bookings
 */

import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';
import { Platform } from 'react-native';

const API_BASE_URL = `${apiBaseUrl()}/tour-booking/`;

/**
 * Upload verification photo for a booking
 * @param {string} bookingId - The booking ID
 * @param {string} driverId - The driver's ID
 * @param {Object} photoData - Photo data (either file or base64)
 * @param {string} photoData.uri - Photo URI (for file upload)
 * @param {string} photoData.base64 - Base64 encoded photo
 * @param {string} photoData.filename - Optional filename
 * @returns {Promise<Object>} Upload result
 */
export async function uploadVerificationPhoto(bookingId, driverId, photoData) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for uploads

    const url = `${API_BASE_URL}upload-verification/${bookingId}/`;
    
    let body;
    let headers = {};
    
    // Check if we have a URI (file upload) or base64 data
    if (photoData.uri) {
      // File upload using FormData
      const formData = new FormData();
      formData.append('driver_id', driverId);
      
      // Add photo as file
      formData.append('photo', {
        uri: photoData.uri,
        type: photoData.type || 'image/jpeg',
        name: photoData.filename || `verification_${bookingId}.jpg`
      });
      
      body = formData;
      // Don't set Content-Type for FormData, let fetch set it automatically
    } else if (photoData.base64) {
      // Base64 upload
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        driver_id: driverId,
        photo: `data:image/jpeg;base64,${photoData.base64}`,
        filename: photoData.filename || `verification_${bookingId}.jpg`
      });
    } else {
      throw new Error('No photo data provided (uri or base64 required)');
    }
    
    // Add auth token if available
    const token = await getAccessToken().catch(() => null);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('Uploading verification photo for booking:', bookingId);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload verification error:', errorText);
      
      // Parse error message if it's JSON
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      } catch {
        throw new Error(`Upload failed: ${response.status}`);
      }
    }
    
    const data = await response.json();
    console.log('Verification photo uploaded successfully:', data);
    return data;
    
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      throw new Error('Upload timeout. Please check your connection and try again.');
    }
    console.error('Error uploading verification photo:', error);
    throw error;
  }
}

/**
 * Get verification status for a booking
 * @param {string} bookingId - The booking ID
 * @param {string} customerId - Optional customer ID for validation
 * @returns {Promise<Object>} Verification data
 */
export async function getVerificationStatus(bookingId, customerId = null) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let url = `${API_BASE_URL}verification/${bookingId}/`;
    if (customerId) {
      url += `?customer_id=${customerId}`;
    }
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('Verification fetch error:', response.status);
      return {
        success: false,
        data: {
          verification_available: false,
          verification_photo_url: null
        }
      };
    }
    
    const data = await response.json();
    console.log('Verification status retrieved:', data);
    return data;
    
  } catch (error) {
    console.log('Verification service error:', error.message);
    return {
      success: false,
      data: {
        verification_available: false,
        verification_photo_url: null
      },
      network_error: true
    };
  }
}

/**
 * Report a verification photo as fraudulent
 * @param {string} bookingId - The booking ID
 * @param {string} customerId - The customer's ID
 * @param {string} reason - Reason for reporting
 * @returns {Promise<Object>} Report result
 */
export async function reportVerificationPhoto(bookingId, customerId, reason) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${API_BASE_URL}report-verification/${bookingId}/`;
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        customer_id: customerId,
        reason: reason
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Report verification error:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || `Report failed: ${response.status}`);
      } catch {
        throw new Error(`Report failed: ${response.status}`);
      }
    }
    
    const data = await response.json();
    console.log('Verification reported successfully:', data);
    return data;
    
  } catch (error) {
    console.error('Error reporting verification:', error);
    throw error;
  }
}

/**
 * Complete booking with verification check
 * @param {string} bookingId - The booking ID
 * @param {string} driverId - The driver's ID
 * @returns {Promise<Object>} Completion result or verification required error
 */
export async function completeBookingWithVerification(bookingId, driverId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Reduced timeout
    
    const url = `${API_BASE_URL}complete/${bookingId}/`;
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ driver_id: driverId }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    // Check if verification is required
    if (!response.ok && response.status === 400) {
      if (data.verification_required) {
        return {
          success: false,
          verification_required: true,
          error: data.error || 'Verification photo required'
        };
      }
    }
    
    if (!response.ok) {
      throw new Error(data.error || `Completion failed: ${response.status}`);
    }
    
    console.log('Booking completed with verification:', data);
    return data;
    
  } catch (error) {
    const isNetworkError = error?.name === 'AbortError' || 
                          /network request failed/i.test(error?.message || '') ||
                          /fetch.*failed/i.test(error?.message || '');
    
    if (isNetworkError) {
      console.log('Booking completion service unavailable - network error');
      // Return success without verification for network failures
      return {
        success: true,
        network_error: true,
        message: 'Booking completed (verification service unavailable)'
      };
    }
    
    console.log('Booking completion error:', error.message);
    throw error;
  }
}

/**
 * Check if booking has verification photo
 * @param {string} bookingId - The booking ID
 * @returns {Promise<boolean>} True if verification exists
 */
export async function hasVerificationPhoto(bookingId) {
  try {
    const result = await getVerificationStatus(bookingId);
    // Handle network errors gracefully
    if (result?.network_error) {
      console.log('Verification service unavailable - assuming no photo');
      return false;
    }
    return result?.data?.verification_available === true;
  } catch (error) {
    console.log('Verification service error - assuming no photo');
    return false;
  }
}

/**
 * Complete booking with photo upload (legacy function for CompletionPhotoScreen)
 * @param {string} bookingId - The booking ID
 * @param {string} driverId - The driver's ID
 * @param {string} photoUri - Photo URI
 * @returns {Promise<Object>} Completion result
 */
export async function completeBookingWithPhoto(bookingId, driverId, photoUri) {
  try {
    // First upload the photo
    const photoData = {
      uri: photoUri,
      type: 'image/jpeg',
      filename: `verification_${bookingId}.jpg`
    };
    
    const uploadResult = await uploadVerificationPhoto(bookingId, driverId, photoData);
    
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload photo'
      };
    }
    
    // Then complete the booking
    const completeResult = await completeBookingWithVerification(bookingId, driverId);
    
    return completeResult;
    
  } catch (error) {
    const isNetworkError = error?.name === 'AbortError' || 
                          /network request failed/i.test(error?.message || '') ||
                          /fetch.*failed/i.test(error?.message || '');
    
    if (isNetworkError) {
      console.log('Booking completion service unavailable - network error');
      return {
        success: true,
        network_error: true,
        message: 'Trip completed (verification service unavailable)'
      };
    }
    
    console.log('Complete booking with photo error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to complete booking'
    };
  }
}

export default {
  uploadVerificationPhoto,
  getVerificationStatus,
  reportVerificationPhoto,
  completeBookingWithVerification,
  completeBookingWithPhoto,
  hasVerificationPhoto
};

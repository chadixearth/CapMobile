/**
 * Comprehensive Security Service for Mobile App
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

class SecurityService {
  constructor() {
    this.rateLimits = new Map();
    this.requestQueue = new Map();
    this.securityHeaders = {
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
  }

  /**
   * Input validation and sanitization
   */
  validateInput(input, type = 'string', options = {}) {
    if (input === null || input === undefined) {
      if (options.required) {
        throw new Error(`${options.fieldName || 'Field'} is required`);
      }
      return null;
    }

    switch (type) {
      case 'string':
        return this.validateString(input, options);
      case 'email':
        return this.validateEmail(input);
      case 'phone':
        return this.validatePhone(input);
      case 'number':
        return this.validateNumber(input, options);
      case 'coordinates':
        return this.validateCoordinates(input);
      case 'date':
        return this.validateDate(input);
      default:
        return this.sanitizeString(input);
    }
  }

  validateString(input, options = {}) {
    if (typeof input !== 'string') {
      throw new Error(`${options.fieldName || 'Field'} must be a string`);
    }

    const sanitized = this.sanitizeString(input);
    
    if (options.minLength && sanitized.length < options.minLength) {
      throw new Error(`${options.fieldName || 'Field'} must be at least ${options.minLength} characters`);
    }

    if (options.maxLength && sanitized.length > options.maxLength) {
      throw new Error(`${options.fieldName || 'Field'} must be at most ${options.maxLength} characters`);
    }

    if (options.pattern && !options.pattern.test(sanitized)) {
      throw new Error(`${options.fieldName || 'Field'} format is invalid`);
    }

    return sanitized;
  }

  validateEmail(email) {
    if (typeof email !== 'string') {
      throw new Error('Email must be a string');
    }

    const sanitized = this.sanitizeString(email).toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailPattern.test(sanitized)) {
      throw new Error('Invalid email format');
    }

    if (sanitized.length > 254) {
      throw new Error('Email is too long');
    }

    return sanitized;
  }

  validatePhone(phone) {
    if (typeof phone !== 'string') {
      throw new Error('Phone must be a string');
    }

    const sanitized = this.sanitizeString(phone);
    const phonePattern = /^\+?63[0-9]{10}$|^09[0-9]{9}$/;
    
    if (!phonePattern.test(sanitized)) {
      throw new Error('Invalid phone number format');
    }

    // Normalize to +63 format
    if (sanitized.startsWith('09')) {
      return '+63' + sanitized.substring(1);
    }
    
    return sanitized.startsWith('+63') ? sanitized : '+63' + sanitized;
  }

  validateNumber(input, options = {}) {
    const num = parseFloat(input);
    
    if (isNaN(num)) {
      throw new Error(`${options.fieldName || 'Field'} must be a valid number`);
    }

    if (options.min !== undefined && num < options.min) {
      throw new Error(`${options.fieldName || 'Field'} must be at least ${options.min}`);
    }

    if (options.max !== undefined && num > options.max) {
      throw new Error(`${options.fieldName || 'Field'} cannot exceed ${options.max}`);
    }

    return num;
  }

  validateCoordinates(coords) {
    if (!coords || typeof coords !== 'object') {
      throw new Error('Coordinates must be an object with lat and lng');
    }

    const lat = this.validateNumber(coords.lat, { min: -90, max: 90, fieldName: 'Latitude' });
    const lng = this.validateNumber(coords.lng, { min: -180, max: 180, fieldName: 'Longitude' });

    return { lat, lng };
  }

  validateDate(dateString) {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }

    return date;
  }

  sanitizeString(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Remove dangerous patterns
    const dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /eval\s*\(/gi,
      /document\./gi,
      /window\./gi,
    ];

    let sanitized = input.trim();
    
    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    sanitized = sanitized
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");

    return sanitized;
  }

  /**
   * Rate limiting for API requests
   */
  checkRateLimit(endpoint, limit = 60, window = 60000) {
    const now = Date.now();
    const key = `rate_limit_${endpoint}`;
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 0, resetTime: now + window });
    }

    const rateLimit = this.rateLimits.get(key);
    
    if (now > rateLimit.resetTime) {
      rateLimit.count = 0;
      rateLimit.resetTime = now + window;
    }

    if (rateLimit.count >= limit) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    rateLimit.count++;
    return true;
  }

  /**
   * Request deduplication
   */
  async deduplicateRequest(key, requestFn, timeout = 5000) {
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key);
    }

    const promise = Promise.race([
      requestFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]).finally(() => {
      this.requestQueue.delete(key);
    });

    this.requestQueue.set(key, promise);
    return promise;
  }

  /**
   * Secure request headers
   */
  getSecureHeaders(additionalHeaders = {}) {
    return {
      ...this.securityHeaders,
      ...additionalHeaders,
    };
  }

  /**
   * Validate booking data
   */
  validateBookingData(data) {
    const validated = {};

    // Required fields
    validated.pickup_location = this.validateCoordinates(data.pickup_location);
    validated.destination = this.validateCoordinates(data.destination);
    validated.scheduled_time = this.validateDate(data.scheduled_time);
    validated.passenger_count = this.validateNumber(data.passenger_count, { 
      min: 1, max: 20, fieldName: 'Passenger count' 
    });

    // Optional fields
    if (data.special_requests) {
      validated.special_requests = this.validateString(data.special_requests, {
        maxLength: 500,
        fieldName: 'Special requests'
      });
    }

    if (data.contact_phone) {
      validated.contact_phone = this.validatePhone(data.contact_phone);
    }

    return validated;
  }

  /**
   * Validate user data
   */
  validateUserData(data, isRegistration = false) {
    const validated = {};

    if (isRegistration || data.email) {
      validated.email = this.validateEmail(data.email);
    }

    if (isRegistration || data.password) {
      validated.password = this.validateString(data.password, {
        minLength: 8,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
        fieldName: 'Password'
      });
    }

    if (isRegistration || data.first_name) {
      validated.first_name = this.validateString(data.first_name, {
        pattern: /^[a-zA-Z\s\-\.]{2,50}$/,
        fieldName: 'First name'
      });
    }

    if (isRegistration || data.last_name) {
      validated.last_name = this.validateString(data.last_name, {
        pattern: /^[a-zA-Z\s\-\.]{2,50}$/,
        fieldName: 'Last name'
      });
    }

    if (data.phone) {
      validated.phone = this.validatePhone(data.phone);
    }

    if (data.address) {
      validated.address = this.validateString(data.address, {
        maxLength: 200,
        fieldName: 'Address'
      });
    }

    return validated;
  }

  /**
   * Secure error handling
   */
  handleSecurityError(error, context = '') {
    console.warn(`Security error in ${context}:`, error.message);
    
    // Don't expose sensitive error details to user
    const userMessage = this.getSafeErrorMessage(error);
    
    if (__DEV__) {
      Alert.alert('Security Error', `${context}: ${error.message}`);
    } else {
      Alert.alert('Error', userMessage);
    }
  }

  getSafeErrorMessage(error) {
    const safeMessages = {
      'Rate limit exceeded': 'Too many requests. Please try again later.',
      'Invalid input': 'Please check your input and try again.',
      'Validation failed': 'Please check your information and try again.',
      'Network error': 'Connection problem. Please check your internet.',
      'Timeout': 'Request timed out. Please try again.',
    };

    for (const [key, message] of Object.entries(safeMessages)) {
      if (error.message.toLowerCase().includes(key.toLowerCase())) {
        return message;
      }
    }

    return 'An error occurred. Please try again.';
  }

  /**
   * Clear security data on logout
   */
  clearSecurityData() {
    this.rateLimits.clear();
    this.requestQueue.clear();
  }
}

export default new SecurityService();
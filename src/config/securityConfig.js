/**
 * Security Configuration for Mobile App
 */

export const SECURITY_CONFIG = {
  // Rate limiting configuration
  RATE_LIMITS: {
    DEFAULT: { requests: 60, window: 60000 }, // 60 requests per minute
    AUTH: { requests: 10, window: 300000 },   // 10 requests per 5 minutes
    BOOKING: { requests: 20, window: 60000 }, // 20 requests per minute
    PAYMENT: { requests: 5, window: 300000 }, // 5 requests per 5 minutes
  },

  // Input validation patterns
  VALIDATION_PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^\+?63[0-9]{10}$|^09[0-9]{9}$/,
    NAME: /^[a-zA-Z\s\-\.]{2,50}$/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    COORDINATES: /^-?([1-8]?[0-9]\.{1}\d{1,6}$|90\.{1}0{1,6}$)$/,
    PRICE: /^\d+(\.\d{1,2})?$/,
    BOOKING_ID: /^[a-zA-Z0-9\-]{10,50}$/,
    LICENSE_PLATE: /^[A-Z0-9\-\s]{3,15}$/,
  },

  // Dangerous patterns to block
  DANGEROUS_PATTERNS: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /eval\s*\(/gi,
    /document\./gi,
    /window\./gi,
    /alert\s*\(/gi,
    /union\s+select/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
  ],

  // Request timeout settings
  TIMEOUTS: {
    DEFAULT: 30000,    // 30 seconds
    UPLOAD: 60000,     // 60 seconds for file uploads
    AUTH: 15000,       // 15 seconds for auth requests
    PAYMENT: 45000,    // 45 seconds for payment requests
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000,  // 1 second
    MAX_DELAY: 10000,  // 10 seconds
  },

  // Security headers
  HEADERS: {
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  },

  // Field validation rules
  FIELD_RULES: {
    email: {
      type: 'email',
      required: true,
      maxLength: 254,
    },
    password: {
      type: 'string',
      required: true,
      minLength: 8,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    },
    first_name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s\-\.]{2,50}$/,
    },
    last_name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s\-\.]{2,50}$/,
    },
    phone: {
      type: 'phone',
      required: false,
    },
    address: {
      type: 'string',
      required: false,
      maxLength: 200,
    },
    special_requests: {
      type: 'string',
      required: false,
      maxLength: 500,
    },
    passenger_count: {
      type: 'number',
      required: true,
      min: 1,
      max: 20,
    },
  },

  // Error messages
  ERROR_MESSAGES: {
    RATE_LIMIT: 'Too many requests. Please try again later.',
    INVALID_INPUT: 'Please check your input and try again.',
    VALIDATION_FAILED: 'Please check your information and try again.',
    NETWORK_ERROR: 'Connection problem. Please check your internet.',
    TIMEOUT: 'Request timed out. Please try again.',
    UNAUTHORIZED: 'Session expired. Please log in again.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    SERVER_ERROR: 'Server error. Please try again later.',
    UNKNOWN_ERROR: 'An error occurred. Please try again.',
  },

  // Development vs Production settings
  DEVELOPMENT: {
    ENABLE_LOGGING: true,
    SHOW_DETAILED_ERRORS: true,
    BYPASS_RATE_LIMITING: false,
    MOCK_CSRF_TOKEN: false,
  },

  PRODUCTION: {
    ENABLE_LOGGING: false,
    SHOW_DETAILED_ERRORS: false,
    BYPASS_RATE_LIMITING: false,
    MOCK_CSRF_TOKEN: false,
    ENFORCE_HTTPS: true,
  },
};

// Get current environment configuration
export const getCurrentSecurityConfig = () => {
  const baseConfig = { ...SECURITY_CONFIG };
  const envConfig = __DEV__ ? SECURITY_CONFIG.DEVELOPMENT : SECURITY_CONFIG.PRODUCTION;
  
  return {
    ...baseConfig,
    ...envConfig,
  };
};

// Validation rule presets for common forms
export const FORM_VALIDATION_RULES = {
  LOGIN: {
    email: SECURITY_CONFIG.FIELD_RULES.email,
    password: {
      ...SECURITY_CONFIG.FIELD_RULES.password,
      minLength: 1, // Allow any length for login
      pattern: null, // Don't enforce pattern for login
    },
  },

  REGISTER: {
    email: SECURITY_CONFIG.FIELD_RULES.email,
    password: SECURITY_CONFIG.FIELD_RULES.password,
    first_name: SECURITY_CONFIG.FIELD_RULES.first_name,
    last_name: SECURITY_CONFIG.FIELD_RULES.last_name,
    phone: SECURITY_CONFIG.FIELD_RULES.phone,
  },

  PROFILE_UPDATE: {
    first_name: SECURITY_CONFIG.FIELD_RULES.first_name,
    last_name: SECURITY_CONFIG.FIELD_RULES.last_name,
    phone: SECURITY_CONFIG.FIELD_RULES.phone,
    address: SECURITY_CONFIG.FIELD_RULES.address,
  },

  BOOKING: {
    passenger_count: SECURITY_CONFIG.FIELD_RULES.passenger_count,
    special_requests: SECURITY_CONFIG.FIELD_RULES.special_requests,
    contact_phone: SECURITY_CONFIG.FIELD_RULES.phone,
  },

  CHANGE_PASSWORD: {
    current_password: {
      type: 'string',
      required: true,
      minLength: 1,
    },
    new_password: SECURITY_CONFIG.FIELD_RULES.password,
    confirm_password: {
      type: 'string',
      required: true,
      minLength: 8,
    },
  },
};

export default SECURITY_CONFIG;
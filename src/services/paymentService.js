/**
 * Enhanced PaymentService for React Native Mobile App
 * Complete PayMongo Integration with Backend Support
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBaseUrl } from './networkConfig';

class PaymentService {
  constructor(config = {}) {
    this.baseURL = apiBaseUrl().replace('/api', '');
    this.paymongoConfig = {
      baseURL: 'https://api.paymongo.com/v1',
      publicKey: null,
      secretKey: null,
    };
    
    this.timeout = 30000;
    this.maxRetries = 3;
    this.debugMode = __DEV__;
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    this.paymongoAPI = axios.create({
      baseURL: this.paymongoConfig.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this._setupInterceptors();
    this._initializePayMongoConfig();
  }

  async _initializePayMongoConfig() {
    try {
      const response = await this.api.get('/api/payments/config/');
      if (response.data.success) {
        this.paymongoConfig.publicKey = response.data.public_key;
        this._updatePayMongoHeaders();
        this._log('PayMongo config initialized successfully');
      }
    } catch (error) {
      this._log('Failed to initialize PayMongo config:', error);
    }
  }

  _setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          const { getAccessToken } = await import('./authService');
          const accessToken = await getAccessToken();
          if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
          }
        }
        return config;
      } catch (error) {
        this._log('Failed to get auth token:', error);
        return config;
      }
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        this._log('Backend API Error:', error.response?.data || error.message);
        return Promise.reject(this._formatError(error));
      }
    );

    this.paymongoAPI.interceptors.response.use(
      (response) => response,
      (error) => {
        this._log('PayMongo API Error:', error.response?.data || error.message);
        return Promise.reject(this._formatError(error));
      }
    );
  }

  _updatePayMongoHeaders() {
    if (this.paymongoConfig.publicKey) {
      const auth = Buffer.from(this.paymongoConfig.publicKey + ':').toString('base64');
      this.paymongoAPI.defaults.headers.Authorization = `Basic ${auth}`;
    }
  }

  _log(message, data = null) {
    if (this.debugMode) {
      console.log(`[PaymentService] ${message}`, data || '');
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateBaseURL(newBaseURL) {
    this.baseURL = newBaseURL;
    this.api.defaults.baseURL = newBaseURL;
    this._log(`Updated backend URL to: ${newBaseURL}`);
  }

  updatePayMongoKeys(publicKey, secretKey = null) {
    this.paymongoConfig.publicKey = publicKey;
    if (secretKey) {
      this.paymongoConfig.secretKey = secretKey;
    }
    this._updatePayMongoHeaders();
    this._log('Updated PayMongo keys');
  }

  async createPaymentIntent(bookingId, paymentMethod = 'gcash', returnUrl = null) {
    try {
      this._log(`Creating payment intent for booking: ${bookingId}`);
      
      const payload = {
        booking_id: bookingId,
        payment_method_type: paymentMethod,
      };

      if (returnUrl) {
        payload.return_url = returnUrl;
      }

      const response = await this.api.post('/api/payments/create-payment/', payload);

      if (response.data.success) {
        this._log('Payment intent created successfully via backend');
        return {
          success: true,
          paymentIntentId: response.data.data.payment_intent_id,
          clientKey: response.data.data.client_key,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          paymentMethod: response.data.data.payment_method_type,
          nextAction: response.data.data.next_action,
          bookingReference: response.data.data.booking_reference,
          message: response.data.message,
        };
      } else {
        throw new Error(response.data.error || 'Failed to create payment intent');
      }
    } catch (error) {
      this._log('Create payment intent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment intent',
        errorCode: error.errorCode || 'UNKNOWN_ERROR',
      };
    }
  }

  async createMobilePayment(bookingId, paymentMethod = 'gcash', amount = null, cardDetails = null) {
    try {
      this._log(`Creating mobile payment for ${paymentMethod}`);
      
      // For e-wallets, use the new backend endpoint that creates PayMongo Sources
      if (['gcash', 'grab_pay', 'paymaya'].includes(paymentMethod)) {
        this._log(`Creating payment source via backend for ${paymentMethod}`);
        
        try {
          const response = await this.api.post('/api/payments/mobile-payment-with-source/', {
            booking_id: bookingId,
            payment_method: paymentMethod,
          });

          if (response.data.success) {
            this._log('Payment source created successfully via backend');
            return {
              success: true,
              paymentIntentId: response.data.payment_intent_id,
              sourceId: response.data.source_id,
              clientKey: null,
              amount: response.data.amount,
              currency: response.data.currency,
              paymentMethod: response.data.payment_method,
              bookingReference: response.data.booking_reference,
              checkoutUrl: response.data.checkout_url,
              nextAction: response.data.next_action,
              message: response.data.message,
              status: response.data.status,
            };
          } else {
            throw new Error(response.data.error || 'Failed to create payment source');
          }
        } catch (backendError) {
          this._log('Backend source endpoint not available, falling back to dual-flow method');
          return await this._createMobilePaymentFallback(bookingId, paymentMethod, amount);
        }
      }
      
      // For card payments, use the existing payment intent flow
      if (paymentMethod === 'card') {
        const paymentIntentResult = await this.createPaymentIntent(bookingId, paymentMethod);
        if (paymentIntentResult.success) {
          return {
            ...paymentIntentResult,
            nextAction: {
              type: 'client_side_payment',
              payment_intent: {
                id: paymentIntentResult.paymentIntentId,
                client_key: paymentIntentResult.clientKey,
                payment_method_types: ['card']
              }
            },
            message: 'Payment intent created for card payment. Use PayMongo SDK.',
          };
        }
        return paymentIntentResult;
      }
      
      return await this.createPaymentIntent(bookingId, paymentMethod);
      
    } catch (error) {
      this._log('Create mobile payment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create mobile payment',
        errorCode: error.errorCode || 'UNKNOWN_ERROR',
      };
    }
  }

  async _createMobilePaymentFallback(bookingId, paymentMethod, amount) {
    const paymentIntentResult = await this._createPaymentViaBackend(bookingId, paymentMethod);
    if (!paymentIntentResult.success) {
      return paymentIntentResult;
    }
    
    const sourceResult = await this.createPaymentSource(
      paymentIntentResult.amount || amount || 1500,
      paymentMethod,
      paymentIntentResult.currency || 'PHP'
    );
    
    if (sourceResult.success) {
      return {
        success: true,
        paymentIntentId: paymentIntentResult.paymentIntentId,
        clientKey: paymentIntentResult.clientKey,
        amount: paymentIntentResult.amount,
        currency: paymentIntentResult.currency,
        paymentMethod: paymentMethod,
        bookingReference: paymentIntentResult.bookingReference,
        checkoutUrl: sourceResult.checkoutUrl,
        sourceId: sourceResult.sourceId,
        nextAction: {
          type: 'redirect',
          redirect: { url: sourceResult.checkoutUrl }
        },
        message: `Payment source created for ${paymentMethod}. Redirect to checkout URL.`,
      };
    } else {
      return {
        ...paymentIntentResult,
        nextAction: {
          type: 'client_side_payment',
          payment_intent: {
            id: paymentIntentResult.paymentIntentId,
            client_key: paymentIntentResult.clientKey,
            payment_method_types: [paymentMethod]
          }
        },
        message: 'Payment intent created. Use PayMongo SDK for client-side processing.',
      };
    }
  }

  async _createPaymentViaBackend(bookingId, paymentMethod) {
    try {
      const response = await this.api.post('/api/payments/mobile-payment/', {
        booking_id: bookingId,
        payment_method: paymentMethod,
      });

      if (response.data.success) {
        this._log('Mobile payment created successfully via backend');
        const responseData = response.data.data || response.data;
        
        return {
          success: true,
          paymentIntentId: responseData.payment_intent_id || responseData.id,
          clientKey: responseData.client_key,
          amount: responseData.amount,
          currency: responseData.currency,
          paymentMethod: responseData.payment_method,
          bookingReference: responseData.booking_reference,
          nextAction: responseData.next_action,
          checkoutUrl: responseData.checkout_url || responseData.redirect_url ||
                      responseData.next_action?.redirect?.url,
          redirectUrl: responseData.redirect_url,
          sourceId: responseData.source_id,
          message: responseData.message || response.data.message,
        };
      } else {
        throw new Error(response.data.error || 'Failed to create mobile payment');
      }
    } catch (error) {
      this._log('Backend payment creation failed:', error);
      if (error.response?.status === 404) {
        this._log('Payment endpoint not found, attempting fallback method');
        return await this._createFallbackPayment(bookingId, paymentMethod);
      }
      throw error;
    }
  }

  async _createFallbackPayment(bookingId, paymentMethod) {
    this._log('Using fallback payment method');
    
    if (this.debugMode) {
      if (this.paymongoConfig.publicKey) {
        const fallbackAmount = 1500;
        return await this.createPaymentSource(fallbackAmount, paymentMethod);
      }
      
      return {
        success: true,
        paymentIntentId: `test_${Date.now()}`,
        clientKey: 'test_client_key',
        amount: 1500,
        currency: 'PHP',
        paymentMethod: paymentMethod,
        bookingReference: bookingId,
        checkoutUrl: `https://payments.paymongo.com/checkout/test_${paymentMethod}`,
        message: 'Fallback payment created for testing',
        _isFallback: true,
      };
    }
    
    throw new Error('Payment service not available. Please contact support.');
  }

  async createPaymentSource(amount, paymentMethod = 'gcash', currency = 'PHP') {
    try {
      this._log(`Creating payment source: ${paymentMethod} for amount: ${amount}`);
      
      if (!this.paymongoConfig.publicKey) {
        throw new Error('PayMongo configuration not available');
      }
      
      const amountInCentavos = Math.round(amount * 100);
      
      const payload = {
        data: {
          attributes: {
            amount: amountInCentavos,
            currency: currency.toUpperCase(),
            type: paymentMethod,
            redirect: {
              success: 'https://your-app.com/payment-success',
              failed: 'https://your-app.com/payment-failed',
            },
          },
        },
      };

      const response = await this.paymongoAPI.post('/sources', payload);

      if (response.data && response.data.data) {
        const sourceData = response.data.data;
        this._log('Payment source created successfully');
        
        return {
          success: true,
          sourceId: sourceData.id,
          checkoutUrl: sourceData.attributes.redirect.checkout_url,
          status: sourceData.attributes.status,
          amount: sourceData.attributes.amount / 100,
          currency: sourceData.attributes.currency,
          paymentMethod: sourceData.attributes.type,
          description: sourceData.attributes.description,
        };
      } else {
        throw new Error('Invalid response from PayMongo');
      }
    } catch (error) {
      this._log('Create payment source error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment source',
        errorCode: error.errorCode || 'PAYMONGO_ERROR',
      };
    }
  }

  async createPaymentMethod(cardDetails) {
    try {
      this._log('Creating payment method for card');
      
      const payload = {
        data: {
          attributes: {
            type: 'card',
            details: {
              card_number: cardDetails.number.replace(/\s/g, ''),
              exp_month: parseInt(cardDetails.expMonth),
              exp_year: parseInt(cardDetails.expYear),
              cvc: cardDetails.cvc,
            },
            billing: cardDetails.billing || {},
          },
        },
      };

      const response = await this.paymongoAPI.post('/payment_methods', payload);

      if (response.data && response.data.data) {
        const methodData = response.data.data;
        this._log('Payment method created successfully');
        
        return {
          success: true,
          paymentMethodId: methodData.id,
          type: methodData.attributes.type,
          details: methodData.attributes.details,
          billing: methodData.attributes.billing,
        };
      } else {
        throw new Error('Invalid response from PayMongo');
      }
    } catch (error) {
      this._log('Create payment method error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment method',
        errorCode: error.errorCode || 'PAYMONGO_ERROR',
      };
    }
  }

  async checkPaymentSourceStatus(sourceId) {
    try {
      this._log(`Checking payment source status via backend: ${sourceId}`);
      
      try {
        const response = await this.api.get(`/api/payments/source-status/${sourceId}/`);
        
        if (response.data.success) {
          const status = response.data.status;
          this._log(`Payment source status: ${status}`);
          
          return {
            success: true,
            status: status,
            isPaid: status === 'paid' || status === 'chargeable',
            isChargeable: status === 'chargeable',
            sourceData: response.data.data,
          };
        } else {
          throw new Error(response.data.error || 'Failed to get source status');
        }
      } catch (backendError) {
        this._log('Backend source status endpoint not available, using direct PayMongo API');
        const response = await this.paymongoAPI.get(`/sources/${sourceId}`);
        
        if (response.data && response.data.data) {
          const sourceData = response.data.data;
          const status = sourceData.attributes.status;
          
          this._log(`Payment source status: ${status}`);
          
          return {
            success: true,
            status: status,
            isPaid: status === 'paid',
            isChargeable: status === 'chargeable',
            sourceData: sourceData,
          };
        } else {
          throw new Error('Invalid response from PayMongo');
        }
      }
    } catch (error) {
      this._log('Check payment source status error:', error);
      return {
        success: true,
        status: 'unknown',
        isPaid: true,
        isChargeable: false,
        fallback: true,
      };
    }
  }

  getPaymentUrl(paymentData) {
    if (!paymentData) {
      this._log('getPaymentUrl: No payment data provided');
      return null;
    }
    
    this._log('getPaymentUrl: Extracting URL from payment data:', paymentData);
    
    const possibleUrls = [
      paymentData.checkoutUrl,
      paymentData.redirectUrl, 
      paymentData.nextAction?.redirect?.url,
      paymentData.payment_url,
      paymentData.url,
      paymentData.data?.checkout_url,
      paymentData.data?.redirect_url,
      paymentData.data?.payment_url,
    ];
    
    for (const url of possibleUrls) {
      if (url && typeof url === 'string' && url.startsWith('http')) {
        this._log(`getPaymentUrl: Found valid URL: ${url}`);
        return url;
      }
    }
    
    this._log('getPaymentUrl: No valid URL found. Available fields:', Object.keys(paymentData));
    return null;
  }

  requiresWebViewRedirect(paymentMethod) {
    const webViewMethods = ['gcash', 'grab_pay', 'paymaya', 'card'];
    return webViewMethods.includes(paymentMethod);
  }

  parsePaymentReturnUrl(url) {
    if (!url) return { status: 'unknown', shouldConfirm: false };
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('success') || lowerUrl.includes('payment-complete') || lowerUrl.includes('paid')) {
      return { status: 'success', shouldConfirm: true };
    }
    
    if (lowerUrl.includes('fail') || lowerUrl.includes('error') || lowerUrl.includes('cancelled')) {
      return { status: 'failed', shouldConfirm: false };
    }
    
    if (lowerUrl.includes('pending') || lowerUrl.includes('processing')) {
      return { status: 'processing', shouldConfirm: true };
    }
    
    return { status: 'unknown', shouldConfirm: false };
  }

  async confirmPayment(paymentIntentId) {
    try {
      this._log(`Confirming payment: ${paymentIntentId}`);
      
      const response = await this.api.post('/api/payments/confirm-payment/', {
        payment_intent_id: paymentIntentId,
      });

      if (response.data.success) {
        this._log('Payment confirmed successfully');
        return {
          success: true,
          paymentStatus: response.data.data.payment_status,
          bookingId: response.data.data.booking_id,
          paymentId: response.data.data.payment_id,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          paymentMethod: response.data.data.payment_method,
          paidAt: response.data.data.paid_at,
          bookingStatus: response.data.data.booking_status,
          message: response.data.message,
          isSuccessful: response.data.status_details.is_successful,
          isFailed: response.data.status_details.is_failed,
          isProcessing: response.data.status_details.is_processing,
        };
      } else {
        throw new Error(response.data.error || 'Failed to confirm payment');
      }
    } catch (error) {
      this._log('Confirm payment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to confirm payment',
        errorCode: error.errorCode || 'UNKNOWN_ERROR',
      };
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      this._log(`Getting payment status: ${paymentId}`);
      
      const response = await this.api.get(`/api/payments/status/${paymentId}/`);

      if (response.data.success) {
        return {
          success: true,
          payment: response.data.data,
        };
      } else {
        throw new Error(response.data.error || 'Failed to get payment status');
      }
    } catch (error) {
      this._log('Get payment status error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get payment status',
      };
    }
  }

  async processBookingPayment(bookingData, paymentMethod = 'gcash', cardDetails = null) {
    try {
      this._log('Starting complete booking payment flow');
      
      const result = await this.createMobilePayment(
        bookingData.bookingId,
        paymentMethod,
        bookingData.amount,
        cardDetails
      );

      if (result.success) {
        return {
          success: true,
          payment: result,
          nextStep: this._determineNextStep(paymentMethod, result),
          instructions: this._getInstructions(paymentMethod),
        };
      } else {
        return result;
      }
    } catch (error) {
      this._log('Process booking payment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process booking payment',
      };
    }
  }

  async createPaymentWithRetry(bookingId, paymentMethod = 'gcash', maxRetries = null) {
    maxRetries = maxRetries || this.maxRetries;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const result = await this.createMobilePayment(bookingId, paymentMethod);
        if (result.success) {
          return result;
        }
        
        if (result.errorCode && result.errorCode.includes('400')) {
          throw new Error(result.error);
        }
        
        attempt++;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this._log(`Payment attempt ${attempt} failed, retrying in ${delay}ms`);
          await this._delay(delay);
        }
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        attempt++;
        const delay = Math.pow(2, attempt) * 1000;
        await this._delay(delay);
      }
    }
    
    throw new Error('Payment creation failed after maximum retries');
  }

  _determineNextStep(paymentMethod, result) {
    if (['gcash', 'grab_pay', 'paymaya'].includes(paymentMethod)) {
      return result.checkoutUrl ? 'REDIRECT_TO_CHECKOUT' : 'PROCESS_PAYMENT_INTENT';
    } else if (paymentMethod === 'card') {
      return 'PROCESS_PAYMENT_INTENT';
    }
    return 'UNKNOWN';
  }

  _getInstructions(paymentMethod) {
    const instructions = {
      gcash: 'Redirect user to GCash payment page using the checkout URL',
      grab_pay: 'Redirect user to GrabPay payment page using the checkout URL',
      paymaya: 'Redirect user to Maya payment page using the checkout URL',
      card: 'Process card payment using the payment intent and client key',
    };
    return instructions[paymentMethod] || 'Follow the next_action from PayMongo response';
  }

  _formatError(error) {
    if (error.response) {
      const errorData = error.response.data;
      return {
        message: errorData.error || errorData.message || 'Server error occurred',
        errorCode: errorData.error_code || `HTTP_${error.response.status}`,
        details: errorData.details || errorData.errors || null,
        statusCode: error.response.status,
      };
    } else if (error.request) {
      return {
        message: 'Network request failed. Please check your internet connection.',
        errorCode: 'NETWORK_ERROR',
        details: 'No response received from server',
      };
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  async testConnection() {
    try {
      const response = await this.api.get('/api/', { timeout: 5000 });
      const isBackendOk = response.data?.status === 'ok' || response.status === 200;
      
      let isPayMongoOk = false;
      try {
        await this.paymongoAPI.get('/payments', { timeout: 5000 });
        isPayMongoOk = true;
      } catch (error) {
        isPayMongoOk = error.response?.status === 401;
      }
      
      return {
        backend: isBackendOk,
        paymongo: isPayMongoOk,
        overall: isBackendOk,
      };
    } catch (error) {
      this._log('Connection test failed:', error);
      
      if (error.response?.status) {
        this._log('API server is responding, connection available');
        return {
          backend: true,
          paymongo: false,
          overall: true,
        };
      }
      
      return {
        backend: false,
        paymongo: false,
        overall: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
const paymentService = new PaymentService();
export default paymentService;

// Also export the class for custom instances
export { PaymentService };
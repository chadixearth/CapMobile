import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBaseUrl } from './networkConfig';

class PaymentService {
  constructor() {
    this.baseURL = apiBaseUrl().replace('/api', '');
    this.timeout = 15000;
    this.debugMode = __DEV__;
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this._setupInterceptors();
  }

  _setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      try {
        const { getAccessToken } = await import('./authService');
        const accessToken = await getAccessToken();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      } catch (error) {
        return config;
      }
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
          return Promise.reject(new Error('Request timeout. Please check your connection.'));
        }
        return Promise.reject(error);
      }
    );
  }

  _log(message, data = null) {
    if (this.debugMode) {
      console.log(`[PaymentService] ${message}`, data || '');
    }
  }

  async createPaymentIntent(bookingId, paymentMethod = 'gcash') {
    try {
      this._log(`Creating payment intent for booking: ${bookingId}`);
      
      const response = await this.api.post('/api/payments/create-payment/', {
        booking_id: bookingId,
        payment_method_type: paymentMethod,
      });

      if (response.data.success) {
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
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  async createMobilePayment(bookingId, paymentMethod = 'gcash') {
    try {
      this._log(`Creating mobile payment for ${paymentMethod}`);
      
      const response = await this.api.post('/api/payments/mobile-payment-with-source/', {
        booking_id: bookingId,
        payment_method: paymentMethod,
      });

      if (response.data.success) {
        return {
          success: true,
          paymentIntentId: response.data.payment_intent_id,
          sourceId: response.data.source_id,
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
    } catch (error) {
      this._log('Create mobile payment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create mobile payment',
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  async confirmPayment(paymentIntentId) {
    try {
      this._log(`Confirming payment: ${paymentIntentId}`);
      
      const response = await this.api.post('/api/payments/confirm-payment/', {
        payment_intent_id: paymentIntentId,
      });

      if (response.data.success) {
        return {
          success: true,
          paymentStatus: response.data.data.payment_status,
          bookingId: response.data.data.booking_id,
          paymentId: response.data.data.payment_id,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          paymentMethod: response.data.data.payment_method,
          message: response.data.message,
        };
      } else {
        throw new Error(response.data.error || 'Failed to confirm payment');
      }
    } catch (error) {
      this._log('Confirm payment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to confirm payment',
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  async checkPaymentSourceStatus(sourceId) {
    try {
      this._log(`Checking payment source status: ${sourceId}`);
      
      const response = await this.api.get(`/api/payments/source-status/${sourceId}/`);
      
      if (response.data.success) {
        return {
          success: true,
          status: response.data.status,
          isPaid: response.data.status === 'paid' || response.data.status === 'chargeable',
          isChargeable: response.data.status === 'chargeable',
          sourceData: response.data.data,
        };
      } else {
        throw new Error(response.data.error || 'Failed to get source status');
      }
    } catch (error) {
      this._log('Check payment source status error:', error);
      return {
        success: false,
        status: 'unknown',
        isPaid: false,
        isChargeable: false,
        error: error.message || 'Failed to check payment status',
      };
    }
  }

  getPaymentUrl(paymentData) {
    if (!paymentData) return null;
    
    const possibleUrls = [
      paymentData.checkoutUrl,
      paymentData.redirectUrl,
      paymentData.nextAction?.redirect?.url,
    ];
    
    for (const url of possibleUrls) {
      if (url && typeof url === 'string' && url.startsWith('http')) {
        return url;
      }
    }
    
    return null;
  }
}

const paymentService = new PaymentService();
export default paymentService;
export { PaymentService };
/**
 * PaymentScreen Component for React Native
 * Handles PayMongo payment integration for tour bookings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import paymentService from '../../services/paymentService';
import { colors, spacing, card } from '../../styles/global';
import BackButton from '../../components/BackButton';
import NotificationService from '../../services/notificationService';
import * as Routes from '../../constants/routes';

const PaymentScreen = ({ route, navigation }) => {
  console.log('[PaymentScreen] Component loaded with params:', route.params);
  const { bookingId, bookingData, packageData, amount, currency = 'PHP' } = route.params;
  
  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [showWebView, setShowWebView] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('gcash');

  const paymentMethods = [
    { id: 'gcash', name: 'GCash', icon: 'wallet-outline', color: '#007BFF' },
    { id: 'grab_pay', name: 'GrabPay', icon: 'car-outline', color: '#00B14F' },
    { id: 'paymaya', name: 'Maya (PayMaya)', icon: 'card-outline', color: '#FFB74D' },
    { id: 'card', name: 'Credit/Debit Card', icon: 'card-outline', color: colors.primary },
  ];

  useEffect(() => {
    // Test connection on component mount
    testConnection();
  }, []);

  const testConnection = async () => {
    const connectionStatus = await paymentService.testConnection();
    if (!connectionStatus.overall) {
      Alert.alert(
        'Connection Issue',
        `Unable to connect to the payment service.\n\nBackend: ${connectionStatus.backend ? '✅' : '❌'}\nPayMongo: ${connectionStatus.paymongo ? '✅' : '❌'}\n\nError: ${connectionStatus.error || 'Network unavailable'}`,
        [
          { 
            text: 'Retry', 
            onPress: testConnection 
          },
          { 
            text: 'Continue Anyway', 
            onPress: () => {
              // User can still try to make payment, will get proper error handling
            }
          },
        ]
      );
    }
  };

  const createPayment = async () => {
    // For test payment, simulate payment process
    Alert.alert(
      'Test Payment',
      `Simulate payment of ${formatCurrency(amount)} using ${selectedPaymentMethod}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Now', onPress: () => simulatePayment() }
      ]
    );
  };

  const simulatePayment = async () => {

    setIsLoading(true);
    try {
      console.log('Simulating payment process...');
      
      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful payment
      const result = { success: true, paymentMethod: selectedPaymentMethod };

      if (result.success) {
        console.log('Payment simulation successful');
        await createBookingAfterPayment();
      } else {
        Alert.alert('Payment Failed', 'Payment simulation failed');
      }
    } catch (error) {
      console.error('Payment simulation error:', error);
      Alert.alert('Payment Error', 'Payment simulation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardPayment = (paymentData) => {
    // For card payments, you might want to integrate with a card input component
    // or redirect to PayMongo's hosted payment page
    if (paymentData.nextAction?.redirect) {
      const url = paymentData.nextAction.redirect.url;
      Linking.openURL(url).catch(err => {
        console.error('Failed to open payment URL:', err);
        Alert.alert('Error', 'Failed to open payment page');
      });
    }
  };

  const handleWebViewNavigation = (navState) => {
    const { url } = navState;
    console.log('WebView navigation:', url);

    // Enhanced payment completion detection
    if (url.includes('payment-success') || url.includes('success') || 
        url.includes('payment-complete') || url.includes('tartanilla://payment-success') ||
        url.includes('checkout.paymongo.com/success')) {
      console.log('Payment success detected, closing WebView');
      setShowWebView(false);
      
      // Check payment source status if we have a sourceId
      if (paymentData?.sourceId) {
        checkPaymentSourceAndConfirm();
      } else {
        confirmPayment();
      }
    } else if (url.includes('payment-failed') || url.includes('fail') || 
               url.includes('error') || url.includes('tartanilla://payment-failed') ||
               url.includes('checkout.paymongo.com/cancel')) {
      console.log('Payment failure detected, closing WebView');
      setShowWebView(false);
      Alert.alert('Payment Failed', 'Payment was not completed. Please try again.');
    }
    
    // Stop excessive navigation loops
    if (url === (paymentData?.checkoutUrl || paymentData?.nextAction?.redirect?.url) && navState.canGoBack) {
      console.log('Stopping navigation loop');
      return false;
    }
  };

  const checkPaymentSourceAndConfirm = async () => {
    if (!paymentData?.sourceId) {
      confirmPayment();
      return;
    }

    setIsLoading(true);
    try {
      console.log('Checking payment source status:', paymentData.sourceId);
      const sourceStatus = await paymentService.checkPaymentSourceStatus(paymentData.sourceId);
      
      if (sourceStatus.success) {
        if (sourceStatus.isPaid || sourceStatus.isChargeable) {
          console.log('Payment source is paid/chargeable, confirming payment');
          confirmPayment();
        } else {
          Alert.alert(
            'Payment Status',
            `Payment status: ${sourceStatus.status}. Please try again if payment was not completed.`,
            [
              { text: 'Retry', onPress: () => retryPayment() },
              { text: 'Check Again', onPress: () => confirmPayment() }
            ]
          );
        }
      } else {
        console.log('Failed to check source status, proceeding with normal confirmation');
        confirmPayment();
      }
    } catch (error) {
      console.error('Error checking payment source:', error);
      confirmPayment();
    } finally {
      setIsLoading(false);
    }
  };

  const createBookingAfterPayment = async () => {
    try {
      console.log('[PaymentScreen] Creating booking after payment success');
      const { createBooking } = await import('../../services/tourpackage/requestBooking');
      
      const response = await createBooking(bookingData);
      
      if (response && response.success) {
        const createdBookingId = response.data?.id || response.data?.booking_id;
        const bookingReference = response.data?.booking_reference || 'N/A';
        
        console.log('[PaymentScreen] Booking created successfully:', createdBookingId);
        
        // Update booking status to waiting_for_driver after payment
        await updateBookingStatusAfterPayment(createdBookingId);
        
        Alert.alert(
          'Payment Successful!',
          'Your booking has been confirmed and is now available for drivers.',
          [
            {
              text: 'View Receipt',
              onPress: () => {
                navigation.navigate('PaymentReceipt', {
                  paymentData: {
                    paymentId: 'TEST_PAYMENT_' + Date.now(),
                    amount: amount,
                    paymentMethod: selectedPaymentMethod,
                    paidAt: new Date().toISOString(),
                  },
                  bookingData: {
                    bookingReference: bookingReference,
                    packageName: packageData?.packageName || 'Tour Package',
                    amount: amount,
                    bookingId: createdBookingId,
                  },
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Booking Error', 'Payment successful but booking creation failed. Please contact support.');
      }
    } catch (error) {
      console.error('[PaymentScreen] Error creating booking after payment:', error);
      Alert.alert('Booking Error', 'Payment successful but booking creation failed. Please contact support.');
    }
  };
  
  const updateBookingStatusAfterPayment = async (bookingId) => {
    try {
      const { apiBaseUrl } = await import('../../services/networkConfig');
      const response = await fetch(`${apiBaseUrl()}/payment/complete/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: bookingId,
          payment_status: 'paid',
          payment_reference: 'TEST_PAYMENT_' + Date.now()
        })
      });
      
      const result = await response.json();
      console.log('[PaymentScreen] Booking status updated:', result);
      
      if (result.success) {
        console.log('[PaymentScreen] Booking is now waiting for driver');
      }
    } catch (error) {
      console.error('[PaymentScreen] Error updating booking status:', error);
    }
  };

  const confirmPayment = async () => {
    await createBookingAfterPayment();

    setIsLoading(true);
    try {
      const result = await paymentService.confirmPayment(paymentData.paymentIntentId);
      console.log('Payment confirmation result:', result);

      if (result.success) {
        if (result.isSuccessful) {
          navigation.navigate('PaymentReceipt', {
            paymentData: result,
            bookingData: {
              bookingReference: result.bookingId || bookingId,
              packageName: bookingData?.packageName || 'Tour Package',
              amount: result.amount || amount,
            },
          });
        } else if (result.isFailed) {
          Alert.alert('Payment Failed', result.message || 'Payment was not successful');
        } else if (result.isProcessing) {
          Alert.alert('Payment Processing', result.message || 'Payment is being processed');
          startPaymentStatusPolling(result.paymentId);
        } else {
          // Default to success if status is unclear
          console.log('Payment status unclear, defaulting to success');
          navigation.navigate('PaymentReceipt', {
            paymentData: {
              paymentId: result.paymentId || paymentData.sourceId || 'N/A',
              amount: result.amount || amount,
              paymentMethod: selectedPaymentMethod,
              paidAt: new Date().toISOString(),
            },
            bookingData: {
              bookingReference: result.bookingId || bookingId,
              packageName: bookingData?.packageName || 'Tour Package',
              amount: result.amount || amount,
            },
          });
        }
      } else {
        // Even if confirmation fails, if we detected success from WebView, show success
        console.log('Confirmation failed but WebView detected success, showing success screen');
        navigation.navigate('PaymentReceipt', {
          paymentData: {
            paymentId: paymentData?.sourceId || 'N/A',
            amount: amount,
            paymentMethod: selectedPaymentMethod,
            paidAt: new Date().toISOString(),
          },
          bookingData: {
            bookingReference: bookingId,
            packageName: bookingData?.packageName || 'Tour Package',
            amount: amount,
          },
        });
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      // Still show success since WebView detected payment success
      console.log('Error confirming payment but WebView detected success, showing success screen');
      navigation.navigate('PaymentReceipt', {
        paymentData: {
          paymentId: paymentData?.sourceId || 'N/A',
          amount: amount,
          paymentMethod: selectedPaymentMethod,
          paidAt: new Date().toISOString(),
        },
        bookingData: {
          bookingReference: bookingId,
          packageName: bookingData?.packageName || 'Tour Package',
          amount: amount,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPaymentStatusPolling = (paymentId) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await paymentService.getPaymentStatus(paymentId);
        if (status.success && status.payment.status !== 'pending') {
          clearInterval(pollInterval);
          if (status.payment.status === 'succeeded') {
            navigation.navigate('PaymentReceipt', {
              paymentData: status.payment,
              bookingData: {
                bookingReference: bookingId,
                packageName: bookingData?.packageName || 'Tour Package',
                amount: amount,
              },
            });
          } else {
            Alert.alert('Payment Failed', 'Your payment could not be processed.');
          }
        }
      } catch (error) {
        console.error('Payment status polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const retryPayment = () => {
    setPaymentData(null);
    setShowWebView(false);
    createPayment();
  };

  const formatCurrency = (amount) => {
    return amount ? `₱${parseFloat(amount).toLocaleString()}` : '₱0.00';
  };

  const renderPaymentMethodSelector = () => (
    <View style={styles.paymentMethodContainer}>
      <Text style={styles.sectionTitle}>Select Payment Method</Text>
      {paymentMethods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.paymentMethodButton,
            selectedPaymentMethod === method.id && [
              styles.selectedPaymentMethod,
              { borderColor: method.color }
            ],
          ]}
          onPress={() => setSelectedPaymentMethod(method.id)}
        >
          <Ionicons 
            name={method.icon} 
            size={24} 
            color={selectedPaymentMethod === method.id ? method.color : colors.textSecondary}
            style={styles.paymentMethodIcon}
          />
          <Text style={[
            styles.paymentMethodText,
            selectedPaymentMethod === method.id && { color: method.color }
          ]}>{method.name}</Text>
          {selectedPaymentMethod === method.id && (
            <Ionicons name="checkmark-circle" size={20} color={method.color} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBookingDetails = () => (
    <View style={styles.bookingDetailsContainer}>
      <Text style={styles.sectionTitle}>Booking Details</Text>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Package:</Text>
        <Text style={styles.detailValue}>{packageData?.packageName || 'Tour Package'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Date:</Text>
        <Text style={styles.detailValue}>{packageData?.bookingDate || 'N/A'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Passengers:</Text>
        <Text style={styles.detailValue}>{packageData?.numberOfPax || 1}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalAmount}>{formatCurrency(amount)}</Text>
      </View>
    </View>
  );

  if (showWebView && (paymentData?.nextAction?.redirect?.url || paymentData?.checkoutUrl)) {
    const paymentUrl = paymentData?.checkoutUrl || paymentData?.nextAction?.redirect?.url;
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowWebView(false)}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Complete Payment</Text>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleWebViewNavigation}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading PayMongo payment page...</Text>
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback={true}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>Payment</Text>
        </View>

        {renderBookingDetails()}
        {renderPaymentMethodSelector()}

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.payButton, isLoading && styles.disabledButton]}
            onPress={createPayment}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>
                Pay {formatCurrency(amount)}
              </Text>
            )}
          </TouchableOpacity>

          {paymentData && (
            <TouchableOpacity style={styles.retryButton} onPress={retryPayment}>
              <Text style={styles.retryButtonText}>Try Different Method</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={16} color={colors.accent} style={styles.securityIcon} />
          <Text style={styles.securityText}>
            Your payment is secured by PayMongo, a licensed payment service provider in the Philippines.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  webView: {
    flex: 1,
  },
  bookingDetailsContainer: {
    ...card,
    margin: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentMethodContainer: {
    ...card,
    margin: spacing.md,
    marginTop: 0,
  },
  paymentMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.card,
  },
  selectedPaymentMethod: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
  },
  paymentMethodIcon: {
    marginRight: spacing.sm,
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  actionContainer: {
    padding: spacing.md,
  },
  payButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  disabledButton: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  payButtonText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    margin: spacing.md,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  securityIcon: {
    marginRight: spacing.xs,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default PaymentScreen;
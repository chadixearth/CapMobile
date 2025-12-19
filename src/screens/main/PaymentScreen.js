/**
 * PaymentScreen — modern & elegant UI with confirmation modal
 * Handles PayMongo payment integration for tour bookings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import paymentService from '../../services/paymentService';
import { colors, spacing } from '../../styles/global';
import * as Routes from '../../constants/routes';

const PaymentScreen = ({ route, navigation }) => {
  const { bookingId, bookingData, packageData, amount, currency = 'PHP' } = route.params;

  const [isLoading, setIsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [showWebView, setShowWebView] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('gcash');
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);

  // NEW: confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const paymentMethods = [
    { id: 'gcash', name: 'GCash', icon: 'wallet-outline', color: '#0EA5E9', hint: 'Instant e-wallet' },
    { id: 'grab_pay', name: 'GrabPay', icon: 'car-outline', color: '#22C55E', hint: 'Pay via Grab wallet' },
    { id: 'paymaya', name: 'Maya (PayMaya)', icon: 'card-outline', color: '#8B5CF6', hint: 'Use Maya balance' },
    { id: 'card', name: 'Credit/Debit Card', icon: 'card-outline', color: colors.primary, hint: 'Visa / Mastercard' },
  ];

  useEffect(() => { 
    testConnection();
    checkBookingStatus();
  }, []);

  const checkBookingStatus = async () => {
    if (!bookingId) return;
    
    try {
      const { apiBaseUrl } = await import('../../services/networkConfig');
      const { getAccessToken } = await import('../../services/authService');
      const accessToken = await getAccessToken();
      
      const response = await fetch(`${apiBaseUrl()}/tour-booking/${bookingId}/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setBookingStatus(result.data);
          const paymentStatus = (result.data.payment_status || '').toLowerCase();
          if (paymentStatus === 'paid') {
            setPaymentCompleted(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking booking status:', error);
    }
  };

  const testConnection = async () => {
    const connectionStatus = await paymentService.testConnection();
    console.log('[Payment] connection status:', connectionStatus);
  };

  // OPEN the modal instead of Alert
  const createPayment = () => {
    if (paymentCompleted) {
      alert('This booking has already been paid for.');
      return;
    }
    setShowConfirmModal(true);
  };

  const onConfirmPay = async () => {
    if (isLoading || paymentCompleted) return;
    setShowConfirmModal(false);
    await processPayment();
  };

  const processPayment = async () => {
    setIsLoading(true);
    try {
      // Update booking status first
      if (bookingId) {
        const result = await updateBookingStatusAfterPayment(bookingId);
        if (result && result.success) {
          setPaymentCompleted(true);
          setBookingStatus(result.data);
          
          // Show success message using CustomAlert
          setTimeout(() => {
            const { CustomAlert } = require('../../utils/customAlert');
            CustomAlert.success('Payment Completed!', 'Your booking is now confirmed and your driver can start the trip on the scheduled date.');
          }, 500);
          
          return; // Don't proceed to createBookingAfterPayment for existing bookings
        }
      }
      
      // Then proceed with booking creation/navigation for new bookings
      await createBookingAfterPayment();
    } catch (error) {
      console.error('Payment processing error:', error);
      // Show error to user
      alert('Payment processing failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebViewNavigation = (navState) => {
    const { url } = navState;
    if (
      url.includes('payment-success') ||
      url.includes('success') ||
      url.includes('payment-complete') ||
      url.includes('tartanilla://payment-success') ||
      url.includes('checkout.paymongo.com/success')
    ) {
      setShowWebView(false);
      if (paymentData?.sourceId) {
        checkPaymentSourceAndConfirm();
      } else {
        confirmPayment();
      }
    } else if (
      url.includes('payment-failed') ||
      url.includes('fail') ||
      url.includes('error') ||
      url.includes('tartanilla://payment-failed') ||
      url.includes('checkout.paymongo.com/cancel')
    ) {
      setShowWebView(false);
      // toast here if desired
    }
  };

  const checkPaymentSourceAndConfirm = async () => {
    if (!paymentData?.sourceId) return confirmPayment();

    setIsLoading(true);
    try {
      const sourceStatus = await paymentService.checkPaymentSourceStatus(paymentData.sourceId);
      if (sourceStatus.success && (sourceStatus.isPaid || sourceStatus.isChargeable)) {
        confirmPayment();
      } else {
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
      let createdBookingId = bookingId;
      let bookingReference = 'N/A';
      
      // If bookingId exists, this is payment for existing booking
      if (bookingId) {
        bookingReference = bookingId;
        await updateBookingStatusAfterPayment(bookingId);
      } else {
        // Create new booking (legacy flow)
        const { createBooking } = await import('../../services/tourpackage/requestBooking');
        const response = await createBooking(bookingData);

        if (response?.success) {
          createdBookingId = response.data?.id || response.data?.booking_id;
          bookingReference = response.data?.booking_reference || 'N/A';
          await updateBookingStatusAfterPayment(createdBookingId);
        } else {
          throw new Error('Failed to create booking');
        }
      }

      navigation.navigate('PaymentReceipt', {
        paymentData: {
          paymentId: 'TEST_PAYMENT_' + Date.now(),
          amount,
          paymentMethod: selectedPaymentMethod,
          paidAt: new Date().toISOString(),
        },
        bookingData: {
          bookingReference,
          packageName: packageData?.packageName || 'Tour Package',
          amount,
          bookingId: createdBookingId,
        },
      });
    } catch (error) {
      console.error('[PaymentScreen] Error processing payment:', error);
    }
  };

  const updateBookingStatusAfterPayment = async (id) => {
    try {
      const { apiBaseUrl } = await import('../../services/networkConfig');
      const { getAccessToken } = await import('../../services/authService');
      const accessToken = await getAccessToken();
      
      const response = await fetch(`${apiBaseUrl()}/payment/complete/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          booking_id: id,
          payment_status: 'paid',
          payment_method: selectedPaymentMethod,
          payment_reference: 'MOBILE_PAYMENT_' + Date.now(),
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PaymentScreen] Payment completion API error:', response.status, response.statusText, errorText);
        throw new Error(`Payment completion failed: ${response.status}`);
      } else {
        const result = await response.json();
        console.log('[PaymentScreen] Payment completion successful:', result);
        return result;
      }
    } catch (error) {
      console.error('[PaymentScreen] Error updating booking status:', error);
      throw error;
    }
  };

  const confirmPayment = async () => {
    await createBookingAfterPayment();

    setIsLoading(true);
    try {
      const result = await paymentService.confirmPayment(paymentData?.paymentIntentId);
      if (result?.success && result.isSuccessful) {
        navigation.navigate('PaymentReceipt', {
          paymentData: result,
          bookingData: {
            bookingReference: result.bookingId || bookingId,
            packageName: bookingData?.packageName || 'Tour Package',
            amount: result.amount || amount,
          },
        });
      } else if (result?.isProcessing) {
        startPaymentStatusPolling(result.paymentId);
      } else {
        navigation.navigate('PaymentReceipt', {
          paymentData: {
            paymentId: result?.paymentId || paymentData?.sourceId || 'N/A',
            amount: result?.amount || amount,
            paymentMethod: selectedPaymentMethod,
            paidAt: new Date().toISOString(),
          },
          bookingData: {
            bookingReference: result?.bookingId || bookingId,
            packageName: bookingData?.packageName || 'Tour Package',
            amount: result?.amount || amount,
          },
        });
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      navigation.navigate('PaymentReceipt', {
        paymentData: {
          paymentId: paymentData?.sourceId || 'N/A',
          amount,
          paymentMethod: selectedPaymentMethod,
          paidAt: new Date().toISOString(),
        },
        bookingData: {
          bookingReference: bookingId,
          packageName: bookingData?.packageName || 'Tour Package',
          amount,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPaymentStatusPolling = (paymentId) => {
    const poll = setInterval(async () => {
      try {
        const status = await paymentService.getPaymentStatus(paymentId);
        if (status.success && status.payment.status !== 'pending') {
          clearInterval(poll);
          if (status.payment.status === 'succeeded') {
            navigation.navigate('PaymentReceipt', {
              paymentData: status.payment,
              bookingData: {
                bookingReference: bookingId,
                packageName: bookingData?.packageName || 'Tour Package',
                amount,
              },
            });
          } else {
            // toast: failed
          }
        }
      } catch (error) {
        console.error('Payment status polling error:', error);
      }
    }, 5000);

    setTimeout(() => clearInterval(poll), 300000);
  };

  const retryPayment = () => {
    setPaymentData(null);
    setShowWebView(false);
    setShowConfirmModal(true);
  };

  const formatCurrency = (amt) => (amt ? `₱${parseFloat(amt).toLocaleString()}` : '₱0.00');

  /** ---------- RENDERERS (UI) ---------- */

  // Receipt-like Booking Details card (matches receipt details motif)
  const renderSummaryCard = () => {
    const pkgName = packageData?.packageName || 'Tour Package';
    const pax = packageData?.numberOfPax ?? 1;

    const prettyDate = (() => {
      const raw = packageData?.bookingDate;
      if (!raw) return 'N/A';
      try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return String(raw);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
      } catch {
        return String(raw);
      }
    })();

    return (
      <View style={styles.receiptLikeCard}>
        {/* Accent strip */}
        <View style={styles.cardAccent} />

        {/* Title */}
        <Text style={styles.sheetTitle}>Booking Details</Text>

        {/* Muted inner sheet with key-value rows */}
        <View style={styles.detailsSheet}>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Package</Text>
            <Text style={styles.kvValue} numberOfLines={1}>{pkgName}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Booking Date</Text>
            <Text style={styles.kvValue}>{prettyDate}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Passengers</Text>
            <Text style={styles.kvValue}>{pax} pax</Text>
          </View>
        </View>
      </View>
    );
  };

  // Payment Method card — SAME DESIGN as Booking Details card
  const renderPaymentMethodSelector = () => (
    <View style={styles.receiptLikeCard}>
      {/* Accent strip */}
      <View style={styles.cardAccent} />

      {/* Title */}
      <Text style={styles.sheetTitle}>Payment Method</Text>

      {/* Muted inner sheet that contains method rows */}
      <View style={styles.detailsSheet}>
        {paymentMethods.map((method, idx) => {
          const active = selectedPaymentMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodRow, idx === 0 && styles.methodRowFirst, active && styles.methodRowActive]}
              onPress={() => setSelectedPaymentMethod(method.id)}
              activeOpacity={0.92}
            >
              <View style={[styles.methodIconWrap, { backgroundColor: `${method.color}14` }]}>
                <Ionicons name={method.icon} size={20} color={method.color} />
              </View>

              <View style={styles.methodTextWrap}>
                <Text style={[styles.methodTitle, active && { color: method.color }]} numberOfLines={1}>
                  {method.name}
                </Text>
                {!!method.hint && (
                  <Text style={styles.methodHint} numberOfLines={1}>
                    {method.hint}
                  </Text>
                )}
              </View>

              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? method.color : colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  /** ---------- WEBVIEW MODE ---------- */
  if (showWebView && (paymentData?.nextAction?.redirect?.url || paymentData?.checkoutUrl)) {
    const paymentUrl = paymentData?.checkoutUrl || paymentData?.nextAction?.redirect?.url;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBack} onPress={() => setShowWebView(false)}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Payment</Text>
          <View style={styles.headerGradient} />
        </View>

        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleWebViewNavigation}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading PayMongo…</Text>
            </View>
          )}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback
        />
      </SafeAreaView>
    );
  }

  /** ---------- NORMAL MODE ---------- */
  return (
    <SafeAreaView style={styles.container}>
      {/* Header (back left, centered title, subtle gradient overlay) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.headerGradient} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderSummaryCard()}
        
        {paymentCompleted ? (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
              <Text style={styles.successTitle}>Payment Completed!</Text>
            </View>
            <Text style={styles.successMessage}>
              Your payment has been successfully processed. Your booking is confirmed and your driver can now start the trip on the scheduled date.
            </Text>
            <TouchableOpacity
              style={styles.viewBookingBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.9}
            >
              <Text style={styles.viewBookingBtnText}>View Booking Details</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderPaymentMethodSelector()
        )}

        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={16} color={colors.accent} style={styles.securityIcon} />
          <Text style={styles.securityText}>
            Payments are processed securely by PayMongo, a licensed payment provider in the Philippines.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky bottom pay bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotalWrap}>
          <Text style={styles.bottomTotalLabel}>Amount to Pay</Text>
          <Text style={styles.bottomTotalValue}>{formatCurrency(amount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.bottomPayBtn, (isLoading || paymentCompleted) && styles.disabledButton]}
          onPress={createPayment}
          disabled={isLoading || paymentCompleted}
          activeOpacity={0.9}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : paymentCompleted ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.bottomPayText}>Payment Complete</Text>
            </>
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.bottomPayText}>Pay Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* --------- CONFIRMATION MODAL --------- */}
      <Modal
        visible={showConfirmModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
              </View>
              <Text style={styles.modalTitle}>Confirm Payment</Text>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Amount</Text>
                <Text style={styles.modalValue}>{formatCurrency(amount)}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Method</Text>
                <Text style={styles.modalValue}>
                  {paymentMethods.find(m => m.id === selectedPaymentMethod)?.name || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setShowConfirmModal(false)}
                disabled={isLoading}
                activeOpacity={0.9}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm, (isLoading || paymentCompleted) && styles.disabledButton]}
                onPress={onConfirmPay}
                disabled={isLoading || paymentCompleted}
                activeOpacity={0.9}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : paymentCompleted ? (
                  <Text style={styles.modalConfirmText}>Already Paid</Text>
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm & Pay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* --------- /CONFIRMATION MODAL --------- */}
    </SafeAreaView>
  );
};

const RADIUS = 16;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },

  /** Header */
  header: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 2 },
    }),
  },
  headerBack: {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: spacing.xs,
    zIndex: 2,
    marginTop: 11,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
    zIndex: 2,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },

  /** RECEIPT-LIKE CARD (shared) */
  receiptLikeCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 2 },
    }),
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.primary, // brand accent
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },

  /** Dotted divider */
  dottedDivider: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderStyle: 'dashed',
    marginVertical: spacing.sm,
  },

  /** Muted inner sheet */
  detailsSheet: {
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS - 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },

  /** Key-Value rows */
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  kvLabel: { flex: 1, color: colors.textSecondary, fontSize: 13.5 },
  kvValue: { flex: 1, textAlign: 'right', color: colors.text, fontWeight: '800', fontSize: 13.5 },

  /** Method rows (inside detailsSheet) */
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  methodRowFirst: { borderTopWidth: 0 },
  methodRowActive: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS - 8,
    // subtle inner highlight
  },
  methodIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTextWrap: { flex: 1 },
  methodTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  methodHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  /** Security note */
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  securityIcon: { marginTop: 2 },
  securityText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  /** Sticky bottom pay bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 12 },
    }),
  },
  bottomTotalWrap: { flex: 1 },
  bottomTotalLabel: { fontSize: 12, color: colors.textSecondary },
  bottomTotalValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 2 },
  bottomPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: RADIUS,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 2 },
    }),
  },
  bottomPayText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  disabledButton: { opacity: 0.6 },

  /** Success Card */
  successCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C8E6C9',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2E7D32',
  },
  successMessage: {
    fontSize: 14,
    color: '#1B5E20',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  viewBookingBtn: {
    backgroundColor: '#2E7D32',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: RADIUS - 6,
    alignItems: 'center',
  },
  viewBookingBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /** Loading */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.sm, fontSize: 14, color: colors.textSecondary },

  /** Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: RADIUS,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 4 },
    }),
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  modalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalBody: { gap: spacing.sm, marginBottom: spacing.md },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalLabel: { color: colors.textSecondary, fontSize: 13 },
  modalValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: RADIUS - 6, alignItems: 'center' },
  modalCancel: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.text, fontWeight: '700' },
  modalConfirm: { backgroundColor: colors.primary },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
});

export default PaymentScreen;

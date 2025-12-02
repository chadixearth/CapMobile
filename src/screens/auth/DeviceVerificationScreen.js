import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../styles/global';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../services/apiClient';

const ACCENT = '#6B2E2B';

const DeviceVerificationScreen = ({ navigation, route }) => {
  const { user_id, email, device_fingerprint } = route.params || {};
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    console.log('[DeviceVerification] Screen mounted with params:', { user_id, email, device_fingerprint });
    
    if (!user_id || !email || !device_fingerprint) {
      Alert.alert('Error', 'Missing verification information. Please try logging in again.', 
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]);
      return;
    }
    
    // Send code immediately
    apiClient.post('/auth/check-device/', { user_id, email, device_fingerprint })
      .then(res => console.log('[DeviceVerification] Code sent:', res.data))
      .catch(err => console.error('[DeviceVerification] Send failed:', err));
    
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const handleCodeChange = (text, index) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && text) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (verificationCode = null) => {
    const fullCode = verificationCode || code.join('');
    
    if (fullCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/verify-device/', {
        user_id,
        device_fingerprint,
        code: fullCode,
      });

      if (response.data.success) {
        // Store auth tokens if provided
        if (response.data.access_token) {
          await AsyncStorage.setItem('access_token', response.data.access_token);
        }
        if (response.data.refresh_token) {
          await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
        }
        if (response.data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        Alert.alert(
          'Device Verified',
          'This device has been verified successfully. You can now log in.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('Login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Verification Failed', response.data.error || 'Invalid verification code.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Device verification error:', error);
      Alert.alert(
        'Verification Error',
        error.response?.data?.error || 'Failed to verify device. Please try again.'
      );
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await apiClient.post('/auth/check-device/', {
        user_id,
        email,
        device_fingerprint,
      });

      if (response.data.success) {
        Alert.alert('Code Resent', 'A new verification code has been sent to your email.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Resend Failed', response.data.error || 'Failed to resend code.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      Alert.alert('Resend Error', 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={ACCENT} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Device Verification</Text>
        <Text style={styles.subtitle}>
          We detected a login from a new device. Please enter the 6-digit code sent to:
        </Text>
        <Text style={styles.email}>{email}</Text>

        {/* Code Input */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!loading}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || code.join('').length !== 6}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Device</Text>
          )}
        </TouchableOpacity>

        {/* Resend Code */}
        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending || loading}
          activeOpacity={0.7}
        >
          {resending ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Text style={styles.resendText}>
              Didn't receive the code? <Text style={styles.resendLink}>Resend</Text>
            </Text>
          )}
        </TouchableOpacity>

        {/* Security Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            This is a security measure to protect your account. The code will expire in 10 minutes.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT + '10',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: ACCENT + '30',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: ACCENT,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  email: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  codeInput: {
    width: 52,
    height: 64,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  codeInputFilled: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '05',
    borderWidth: 3,
  },
  verifyButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resendButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  resendLink: {
    color: ACCENT,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

export default DeviceVerificationScreen;

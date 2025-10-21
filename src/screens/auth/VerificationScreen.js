import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';
import { colors, spacing, card } from '../../styles/global';
import { useError } from '../../components/ErrorProvider';
import { apiRequest } from '../../services/authService';

const ACCENT = '#6B2E2B';

const VerificationScreen = ({ navigation, route }) => {
  const { email, phone, verification_method, user } = route.params || {};
  const { showError } = useError();
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    
    if (verificationCode.length !== 6) {
      showError('Please enter the complete 6-digit code.', { title: 'Incomplete Code', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const identifier = verification_method === 'phone' ? phone : email;
      
      const result = await apiRequest('/auth/verify-code/', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          code: verificationCode
        })
      });

      if (result.success && result.data.success) {
        Alert.alert(
          'Verification Successful',
          'Your account has been verified successfully. You can now log in.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
          { cancelable: false }
        );
      } else {
        showError(result.data?.error || 'Invalid verification code.', { 
          title: 'Verification Failed', 
          type: 'error' 
        });
      }
    } catch (error) {
      showError('Network error. Please try again.', { 
        title: 'Connection Error', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const identifier = verification_method === 'phone' ? phone : email;
      
      const result = await apiRequest('/auth/resend-verification/', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          verification_type: verification_method
        })
      });

      if (result.success && result.data.success) {
        Alert.alert(
          'Code Resent',
          `A new verification code has been sent to your ${verification_method}.`,
          [{ text: 'OK' }]
        );
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        showError(result.data?.error || 'Failed to resend code.', { 
          title: 'Resend Failed', 
          type: 'error' 
        });
      }
    } catch (error) {
      showError('Network error. Please try again.', { 
        title: 'Connection Error', 
        type: 'error' 
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.backCircle, { backgroundColor: ACCENT }]}>
            <BackButton onPress={() => navigation.goBack()} color="#fff" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={verification_method === 'phone' ? 'phone-portrait' : 'mail'} 
              size={48} 
              color={ACCENT} 
            />
          </View>

          <Text style={styles.title}>Verify Your {verification_method === 'phone' ? 'Phone' : 'Email'}</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.contact}>{verification_method === 'phone' ? phone : email}</Text>
          </Text>

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
                onChangeText={(text) => handleCodeChange(text.replace(/[^0-9]/g, ''), index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Text style={styles.verifyButtonText}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              activeOpacity={0.7}
            >
              <Text style={[styles.resendLink, { color: ACCENT }]}>
                {resending ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: Platform.OS === 'ios' ? 14 : 8,
    marginBottom: 20,
  },
  backCircle: {
    marginLeft: -20,
    marginTop: 50,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  contact: {
    fontWeight: '600',
    color: colors.text,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.card,
    ...card,
    shadowOpacity: 0.05,
  },
  codeInputFilled: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '08',
  },
  verifyButton: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...card,
    shadowOpacity: 0.1,
  },
  buttonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default VerificationScreen;
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import BackButton from '../../components/BackButton';
import { apiBaseUrl } from '../../services/networkConfig';

const API_BASE_URL = apiBaseUrl();

const MAROON = '#6B2E2B';
const TEXT_GRAY = '#3A3A3A';
const LINE_GRAY = '#A9A9A9';
const BG = '#F5F5F5';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    if (loading) return;
    
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStep(2);
        Alert.alert('Code Sent', 'A verification code has been sent to your email.');
      } else {
        setError(data.error || 'Failed to send verification code.');
      }
    } catch (e) {
      console.error('Send code error:', e);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (loading) return;
    
    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-reset-code/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStep(3);
      } else {
        setError(data.error || 'Invalid verification code.');
      }
    } catch (e) {
      console.error('Verify code error:', e);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (loading) return;
    
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password-confirm/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          code,
          new_password: newPassword 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        Alert.alert(
          'Password Reset Successful',
          'Your password has been reset successfully. You can now log in with your new password.',
          [
            {
              text: 'Go to Login',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        setError(data.error || 'Failed to reset password.');
      }
    } catch (e) {
      console.error('Reset password error:', e);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar with back button */}
        <View style={styles.topBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        {/* Logo */}
        <Image
          source={require('../../../assets/TarTrack Logo_sakto.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Form */}
        <View style={styles.form}>
          {step === 1 && (
            <>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a verification code.
              </Text>

              <TextInput
                style={styles.underlineInput}
                placeholder="Email Address"
                placeholderTextColor="#9B9B9B"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.resetBtn, loading && { opacity: 0.7 }]}
                onPress={handleSendCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.resetText}>
                  {loading ? 'Sending...' : 'Send Code'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>Enter Verification Code</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to {email}
              </Text>

              <TextInput
                style={styles.underlineInput}
                placeholder="Verification Code"
                placeholderTextColor="#9B9B9B"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.resetBtn, loading && { opacity: 0.7 }]}
                onPress={handleVerifyCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.resetText}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep(1)}
              >
                <Text style={styles.backButtonText}>Back to Email</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>
                Enter your new password below.
              </Text>

              <TextInput
                style={styles.underlineInput}
                placeholder="New Password"
                placeholderTextColor="#9B9B9B"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                returnKeyType="next"
              />

              <TextInput
                style={styles.underlineInput}
                placeholder="Confirm New Password"
                placeholderTextColor="#9B9B9B"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.resetBtn, loading && { opacity: 0.7 }]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.resetText}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.backText}>
            Remember your password?{' '}
            <Text
              style={styles.backLink}
              onPress={() => navigation.goBack()}
            >
              Back to Login
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  topBar: {
    height: 40,
    justifyContent: 'center',
    marginLeft: -20,
  },
  logo: {
    alignSelf: 'center',
    width: 270,
    height: 80,
    marginTop: 100,
    marginBottom: 80,
  },
  form: {
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_GRAY,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  underlineInput: {
    width: '100%',
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_GRAY,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: LINE_GRAY,
    marginBottom: 20,
  },
  error: {
    color: '#D92D20',
    marginBottom: 8,
    textAlign: 'center',
  },
  resetBtn: {
    backgroundColor: MAROON,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 6,
  },
  resetText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backText: {
    textAlign: 'center',
    color: TEXT_GRAY,
    fontSize: 14,
    marginTop: 24,
  },
  backLink: {
    color: MAROON,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: MAROON,
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
});
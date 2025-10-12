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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
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
      const response = await fetch(`${API_BASE_URL}/auth/reset-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess(true);
        Alert.alert(
          'Reset Link Sent',
          'If an account with this email exists, you will receive a password reset link shortly.',
          [
            {
              text: 'Back to Login',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        // Always show generic message for security
        setSuccess(true);
        Alert.alert(
          'Reset Link Sent',
          'If an account with this email exists, you will receive a password reset link shortly.',
          [
            {
              text: 'Back to Login',
              onPress: () => navigation.goBack()
            }
          ]
        );
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
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password.
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

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
});
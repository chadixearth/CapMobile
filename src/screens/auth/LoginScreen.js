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
import * as Routes from '../../constants/routes';
import { loginUser, resendConfirmationEmail } from '../../services/authService';
import { apiBaseUrl } from '../../services/networkConfig';
import AccountDeletionHandler from '../../components/AccountDeletionHandler';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = apiBaseUrl();
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAROON = '#6B2E2B';
const TEXT_GRAY = '#3A3A3A';
const LINE_GRAY = '#A9A9A9';
const BG = '#F5F5F5';

export default function LoginScreen({ navigation }) {
  console.log('[LoginScreen] Component mounted');
  const { login } = useAuth();
  const [email, setEmail] = useState('');       // "Username" in UI
  const [password, setPassword] = useState('');

  // Load saved credentials on mount
  React.useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
      if (savedPassword) {
        setPassword(savedPassword);
      }
    } catch (error) {
      console.log('No saved credentials found');
    }
  };

  const saveCredentials = async () => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('saved_email', email);
        await AsyncStorage.setItem('saved_password', password);
      } else {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
      }
    } catch (error) {
      console.log('Failed to save credentials');
    }
  };
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showDeletionWarning, setShowDeletionWarning] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    
    setError('');
    setLoading(true);
    
    console.log('[LoginScreen] Starting login for:', email);
    
    try {
      // Quick connection test first
      console.log('[LoginScreen] Testing connection to server...');
      const testController = new AbortController();
      const testTimeoutId = setTimeout(() => testController.abort(), 3000);
      
      try {
        const testResponse = await fetch(`${API_BASE_URL}/`, {
          method: 'GET',
          signal: testController.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Connection': 'close',
          },
        });
        clearTimeout(testTimeoutId);
        console.log('[LoginScreen] Connection test result:', testResponse.status);
      } catch (testError) {
        clearTimeout(testTimeoutId);
        console.warn('[LoginScreen] Connection test failed:', testError.message);
        // Don't throw error for connection test failure - just log it
      }
      
      const allowedRoles = ['tourist', 'driver', 'owner'];
      console.log('[LoginScreen] Calling loginUser with:', { email, allowedRoles });
      const result = await loginUser(email, password, allowedRoles);
      console.log('[LoginScreen] Login result:', result);
      
      // Check if password change is required on first login
      if (result.success && result.force_password_change) {
        console.log('[LoginScreen] Force password change required for user:', result.user?.id);
        setLoading(false);
        navigation.navigate(Routes.FORCE_PASSWORD_CHANGE, {
          user: result.user,
          tempPassword: password,
        });
        return;
      }
      
      // Use AccountDeletionHandler to handle login result
      AccountDeletionHandler.handleLoginResult(result, async (successResult) => {
        // Check if user is suspended
        if (successResult.user?.profile?.status === 'Suspended') {
          const suspendedUntil = successResult.user.profile.suspended_until;
          const reason = successResult.user.profile.suspension_reason || 'Account suspended';
          const endDate = suspendedUntil ? new Date(suspendedUntil).toLocaleDateString() : 'Unknown';
          
          Alert.alert(
            'Account Suspended',
            `Your account is suspended.\n\nReason: ${reason}\nSuspension ends: ${endDate}`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
        
        await saveCredentials();
        console.log('[LoginScreen] Calling login function...');
        await login(successResult.user);
        console.log('[LoginScreen] Login function completed');
      });
      
      if (!result.success && !result.scheduled_for_deletion) {
        console.log('[LoginScreen] Login failed:', result.error);
        const errorMsg = result.error || 'Login failed.';
        
        // Handle specific error types with helpful guidance
        if (errorMsg.includes('Invalid email or password') || errorMsg.includes('credentials')) {
          Alert.alert(
            'Login Failed',
            'The email or password you entered is incorrect.\n\nIf you recently changed your password or can\'t remember it, you can reset it using the "Forgot Password" option.',
            [
              { text: 'Try Again', style: 'default' },
              { 
                text: 'Reset Password', 
                onPress: () => navigation.navigate(Routes.FORGOT_PASSWORD)
              }
            ]
          );
        } else if (result.email_confirmation_required || errorMsg.includes('confirm your email')) {
          Alert.alert(
            'Email Confirmation Required',
            'Please check your email and click the confirmation link.',
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Resend Email', 
                onPress: async () => {
                  try {
                    const resendResult = await resendConfirmationEmail(email);
                    if (resendResult.success) {
                      Alert.alert('Email Sent', 'Please check your email.');
                    } else {
                      Alert.alert('Error', 'Failed to send email.');
                    }
                  } catch (error) {
                    Alert.alert('Error', 'Failed to send email.');
                  }
                }
              }
            ]
          );
        } else {
          setError(errorMsg);
        }
      }
    } catch (e) {
      console.error('[LoginScreen] Login error:', e);
      console.error('[LoginScreen] Error details:', {
        name: e.name,
        message: e.message,
        stack: e.stack?.substring(0, 500)
      });
      
      let errorMessage = 'Network error. Please try again.';
      
      if (e.name === 'SyntaxError' && e.message.includes('JSON')) {
        if (e.message.includes('Unterminated string') || e.message.includes('Unexpected end of input')) {
          errorMessage = 'Server configuration error. Please contact support if this persists.';
          console.error('[LoginScreen] Backend is sending truncated JSON responses');
        } else {
          errorMessage = 'Server response error. Please check your connection and try again.';
        }
      } else if (e.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (e.message.includes('Network request failed')) {
        errorMessage = 'Cannot connect to server. Please check your network connection.';
      } else if (e.message.includes('truncated JSON')) {
        errorMessage = 'Server configuration issue. Please try again or contact support.';
      }
      
      setError(errorMessage);
    } finally {
      console.log('[LoginScreen] Setting loading to false');
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
          {/* Username (underline via input itself) */}
          <TextInput
            style={styles.underlineInput}
            placeholder="Username"
            placeholderTextColor="#9B9B9B"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="default"
            returnKeyType="next"
          />

          {/* Password with eye icon; underline only on container */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput} // no border here
              placeholder="Password"
              placeholderTextColor="#9B9B9B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color={TEXT_GRAY}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => navigation.navigate(Routes.FORGOT_PASSWORD)}
            activeOpacity={0.8}
          >
            <Text style={styles.forgotText}>Forgot Password ?</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Remember Me Checkbox */}
          <TouchableOpacity
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.rememberMeText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.loginText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>

          <Text style={styles.registerText}>
            Don’t have an account?{' '}
            <Text
              style={styles.registerLink}
              onPress={() => navigation.navigate(Routes.REGISTRATION, { role: 'tourist' })}
            >
              Sign Up
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
    marginLeft:-20
  },
  logo: {
    alignSelf: 'center',
    width: 270,
    height: 80,
    marginTop: 150,
    marginBottom: 150,
  },
  form: {
    width: '100%',
    alignSelf: 'center',
  },

  // Username input (draws its own underline)
  underlineInput: {
    width: '100%',
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_GRAY,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: LINE_GRAY,
    marginBottom: 20,
  },

  // Password field wrapper draws the underline ONCE
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: LINE_GRAY,
    marginBottom: 20,
  },
  // Text input without any border (no double line)
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_GRAY,
    paddingVertical: 12,
  },
  eyeIcon: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 18,
  },
  forgotText: {
    fontSize: 13,
    color: MAROON,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  error: {
    color: '#D92D20',
    marginBottom: 8,
    textAlign: 'center',
  },

  loginBtn: {
    backgroundColor: MAROON,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 6,
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  registerText: {
    textAlign: 'center',
    color: TEXT_GRAY,
    fontSize: 14,
    marginTop: 14,
  },
  registerLink: {
    color: MAROON,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: MAROON,
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: MAROON,
  },
  rememberMeText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
});

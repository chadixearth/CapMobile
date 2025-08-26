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
} from 'react-native';
import BackButton from '../../components/BackButton';
import * as Routes from '../../constants/routes';
import { loginUser } from '../../services/authService';
import { Ionicons } from '@expo/vector-icons'; // eye / eye-off icon

const MAROON = '#6B2E2B';
const TEXT_GRAY = '#3A3A3A';
const LINE_GRAY = '#A9A9A9';
const BG = '#F5F5F5';

export default function LoginScreen({ navigation, setRole, setIsAuthenticated }) {
  const [email, setEmail] = useState('');       // "Username" in UI
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const allowedRoles = ['tourist', 'driver', 'owner'];
      const result = await loginUser(email, password, allowedRoles);
      setLoading(false);
      if (result.success) {
        const userRole = result.user?.role || 'tourist';
        setRole?.(userRole);
        setIsAuthenticated?.(true);
        navigation.reset({ index: 0, routes: [{ name: Routes.MAIN }] });
      } else {
        setError(result.error || 'Login failed.');
      }
    } catch (e) {
      setLoading(false);
      setError('Network error. Please try again.');
      console.error('Login error:', e);
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
            onPress={() => navigation.navigate(Routes.FORGOT_PASSWORD || 'ForgotPassword')}
            activeOpacity={0.8}
          >
            <Text style={styles.forgotText}>Forgot Password ?</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
              Create Account
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
    marginTop: 13,
  },
  logo: {
    alignSelf: 'center',
    width: 270,
    height: 80,
    marginTop: 190,
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
});

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
import { Ionicons } from '@expo/vector-icons';
import { changePassword } from '../../services/authService';
import * as Routes from '../../constants/routes';

const MAROON = '#6B2E2B';
const TEXT_GRAY = '#3A3A3A';
const LINE_GRAY = '#A9A9A9';
const BG = '#F5F5F5';

export default function ForcePasswordChangeScreen({ navigation, route }) {
  const { user, tempPassword } = route.params || {};
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = () => {
    if (!newPassword || !confirmPassword) {
      setError('Both password fields are required.');
      return false;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    if (tempPassword && newPassword === tempPassword) {
      setError('New password must be different from the temporary password.');
      return false;
    }

    return true;
  };

  const handlePasswordChange = async () => {
    if (loading) return;

    setError('');

    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      const result = await changePassword(tempPassword || '', newPassword);

      if (result.success) {
        Alert.alert(
          'Success',
          'Your password has been changed successfully. Please login with your new password.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: Routes.LOGIN }],
                });
              },
            },
          ],
          { cancelable: false }
        );
        // Auto-navigate after 3 seconds if user doesn't press OK
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: Routes.LOGIN }],
          });
        }, 3000);
      } else {
        setError(result.error || 'Failed to change password. Please try again.');
      }
    } catch (e) {
      console.error('Password change error:', e);
      setError('An error occurred. Please try again.');
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
        {/* Logo */}
        <Image
          source={require('../../../assets/TarTrack Logo_sakto.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Title */}
        <Text style={styles.title}>Change Your Password</Text>
        <Text style={styles.subtitle}>
          For security, you must change your password on your first login.
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {/* New Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="New Password"
              placeholderTextColor="#9B9B9B"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="next"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeIcon}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showNewPassword ? 'eye-off' : 'eye'}
                size={22}
                color={TEXT_GRAY}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password"
              placeholderTextColor="#9B9B9B"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={22}
                color={TEXT_GRAY}
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Password Requirements */}
          <View style={styles.requirements}>
            <Text style={styles.requirementTitle}>Password Requirements:</Text>
            <Text style={styles.requirementText}>• At least 6 characters</Text>
            <Text style={styles.requirementText}>• Different from temporary password</Text>
          </View>

          {/* Change Password Button */}
          <TouchableOpacity
            style={[styles.changeBtn, loading && { opacity: 0.7 }]}
            onPress={handlePasswordChange}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.changeBtnText}>
              {loading ? 'Changing Password...' : 'Change Password'}
            </Text>
          </TouchableOpacity>
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
    paddingTop: 20,
    paddingBottom: 32,
  },
  logo: {
    alignSelf: 'center',
    width: 270,
    height: 80,
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_GRAY,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: LINE_GRAY,
    marginBottom: 20,
  },
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
  error: {
    color: '#D92D20',
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  requirements: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
    padding: 12,
    marginBottom: 24,
    borderRadius: 4,
  },
  requirementTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_GRAY,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  changeBtn: {
    backgroundColor: MAROON,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  changeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

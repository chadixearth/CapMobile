import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { createAccountWithEmail } from '../../services/userService';

const MAROON = '#6B2E2B';

const RegistrationScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const role = route?.params?.role || 'tourist';

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    if (!email || !password || !confirmPassword) {
      setError('Please enter email, password, and confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await createAccountWithEmail(email, password, role);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Registration successful! Please check your email to verify your account.');
      Alert.alert(
        'Registration Successful',
        'Please check your email to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ],
        { cancelable: false }
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Register as {role.charAt(0).toUpperCase() + role.slice(1)}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#aaa"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="next"
            blurOnSubmit={false}
            editable={true}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#aaa"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="next"
            blurOnSubmit={false}
            editable={true}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor="#aaa"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            blurOnSubmit={true}
            editable={true}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{loading ? 'Registering...' : 'Register'}</Text>
          </TouchableOpacity>
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Already have an account? <Text style={styles.linkBold}>Login</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAROON,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    width: '88%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    color: MAROON,
    letterSpacing: 1,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#faf8f6',
    minHeight: 48,
  },
  button: {
    backgroundColor: MAROON,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 1,
  },
  link: {
    color: MAROON,
    marginTop: 22,
    textDecorationLine: 'underline',
    fontSize: 15,
  },
  linkBold: {
    fontWeight: 'bold',
    color: MAROON,
  },
  error: {
    color: 'red',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  success: {
    color: 'green',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
});

export default RegistrationScreen; 
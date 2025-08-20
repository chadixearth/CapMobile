import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { loginUser } from '../../services/authService';
import * as Routes from '../../constants/routes';

const MAROON = '#6B2E2B';

export default function LoginScreen({ navigation, setRole, setIsAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      // Only allow mobile roles (no admin)
      const allowedRoles = ['tourist', 'driver', 'owner'];
      const result = await loginUser(email, password, allowedRoles);
      
      setLoading(false);
      
      if (result.success) {
        // Get role from user data
        const userRole = result.user?.role || 'tourist';
        setRole(userRole);
        if (setIsAuthenticated) {
          setIsAuthenticated(true);
        }
        // Reset navigation stack to prevent going back to login
        navigation.reset({
          index: 0,
          routes: [{ name: Routes.MAIN }],
        });
      } else {
        setError(result.error || 'Login failed.');
      }
    } catch (error) {
      setLoading(false);
      setError('Network error. Please try again.');
      console.error('Login error:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.root} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Login</Text>
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
            returnKeyType="done"
            blurOnSubmit={true}
            editable={true}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>
          <Text style={styles.link} onPress={() => navigation.navigate('Registration', { role: 'tourist' })}>
            Don't have an account? <Text style={styles.linkBold}>Register</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
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
});
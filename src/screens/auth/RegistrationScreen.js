import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { registerUser } from '../../services/authService';

const MAROON = '#6B2E2B';

const RegistrationScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const role = route?.params?.role || 'tourist';
  
  // Additional fields for driver/owner
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Driver specific fields
  const [licenseNumber, setLicenseNumber] = useState('');
  
  // Owner specific fields
  const [businessName, setBusinessName] = useState('');
  const [businessPermit, setBusinessPermit] = useState('');

  // Driver-owner combined role capture
  const [ownsTartanilla, setOwnsTartanilla] = useState(false);
  const [ownedCount, setOwnedCount] = useState('0');
  const [drivesOwnTartanilla, setDrivesOwnTartanilla] = useState(false);

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
    
    // Validate additional fields for driver/owner
    if (role === 'driver' || role === 'owner') {
      if (!firstName || !lastName || !phone) {
        setError('Please fill in all required fields.');
        return;
      }
      
      if (role === 'driver' && !licenseNumber) {
        setError('License number is required for drivers.');
        return;
      }
      
      if (role === 'owner' && (!businessName || !businessPermit)) {
        setError('Business name and permit are required for owners.');
        return;
      }
    }
    
    // Validate role for mobile app (no admin)
    const validMobileRoles = ['tourist', 'driver', 'owner'];
    if (!validMobileRoles.includes(role)) {
      setError(`Invalid role. Please select: ${validMobileRoles.join(', ')}`);
      return;
    }
    
    setLoading(true);
    
    try {
      // Prepare additional data based on role
      let additionalData = {};
      
      if (role === 'driver') {
        additionalData = {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          license_number: licenseNumber,
          owns_tartanilla: !!ownsTartanilla,
          owned_count: ownsTartanilla ? Math.max(0, parseInt(ownedCount, 10) || 0) : 0,
        };
      } else if (role === 'owner') {
        additionalData = {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          business_name: businessName,
          business_permit: businessPermit,
          drives_own_tartanilla: !!drivesOwnTartanilla,
        };
      }
      
      const result = await registerUser(email, password, role, additionalData);
      setLoading(false);
      
      if (result.success) {
        setSuccess(result.message || 'Registration successful!');
        
        // Handle different registration outcomes
        if (result.status === 'pending_approval') {
          // Driver/Owner registration - pending admin approval
          Alert.alert(
            'Registration Submitted',
            result.message || `Your ${role} registration has been submitted for admin approval. You will receive an email confirmation once your account is approved.`,
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Login'),
              },
            ],
            { cancelable: false }
          );
        } else {
          // Tourist/Admin registration - direct with email verification
          Alert.alert(
            'Registration Successful',
            result.message || 'Please check your email to verify your account.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Login'),
              },
            ],
            { cancelable: false }
          );
        }
      } else {
        setError(result.error || 'Registration failed.');
      }
    } catch (error) {
      setLoading(false);
      setError('Network error. Please try again.');
      console.error('Registration error:', error);
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
          {(role === 'driver' || role === 'owner') && (
            <Text style={styles.infoText}>
              Your registration will be submitted for admin approval. You will receive an email confirmation once approved.
            </Text>
          )}
          {role === 'tourist' && (
            <Text style={styles.infoText}>
              You will receive an email verification link after registration.
            </Text>
          )}
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
            returnKeyType={role === 'tourist' ? 'done' : 'next'}
            blurOnSubmit={role === 'tourist'}
            editable={true}
          />
          
          {/* Additional fields for driver/owner */}
          {(role === 'driver' || role === 'owner') && (
            <>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor="#aaa"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                blurOnSubmit={false}
                editable={true}
              />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor="#aaa"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                blurOnSubmit={false}
                editable={true}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#aaa"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                blurOnSubmit={false}
                editable={true}
              />
            </>
          )}
          
          {/* Driver specific fields */}
          {role === 'driver' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="License Number"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholderTextColor="#aaa"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                blurOnSubmit={false}
                editable={true}
              />
              <Text style={styles.questionLabel}>Do you also own a tartanilla?</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, ownsTartanilla && styles.toggleBtnSelected]}
                  onPress={() => setOwnsTartanilla(true)}
                >
                  <Text style={[styles.toggleText, ownsTartanilla && styles.toggleTextSelected]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !ownsTartanilla && styles.toggleBtnSelected]}
                  onPress={() => setOwnsTartanilla(false)}
                >
                  <Text style={[styles.toggleText, !ownsTartanilla && styles.toggleTextSelected]}>No</Text>
                </TouchableOpacity>
              </View>
              {ownsTartanilla && (
                <TextInput
                  style={styles.input}
                  placeholder="How many tartanillas do you own?"
                  value={ownedCount}
                  onChangeText={setOwnedCount}
                  keyboardType="number-pad"
                  placeholderTextColor="#aaa"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  editable={true}
                />
              )}
            </>
          )}
          
          {/* Owner specific fields */}
          {role === 'owner' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Business Name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholderTextColor="#aaa"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                blurOnSubmit={false}
                editable={true}
              />
              <TextInput
                style={styles.input}
                placeholder="Business Permit Number"
                value={businessPermit}
                onChangeText={setBusinessPermit}
                placeholderTextColor="#aaa"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="next"
                blurOnSubmit={false}
                editable={true}
              />
              <Text style={styles.questionLabel}>Do you also drive your tartanilla?</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, drivesOwnTartanilla && styles.toggleBtnSelected]}
                  onPress={() => setDrivesOwnTartanilla(true)}
                >
                  <Text style={[styles.toggleText, drivesOwnTartanilla && styles.toggleTextSelected]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !drivesOwnTartanilla && styles.toggleBtnSelected]}
                  onPress={() => setDrivesOwnTartanilla(false)}
                >
                  <Text style={[styles.toggleText, !drivesOwnTartanilla && styles.toggleTextSelected]}>No</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    marginBottom: 16,
    color: MAROON,
    letterSpacing: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    lineHeight: 20,
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
  questionLabel: {
    width: '100%',
    marginBottom: 8,
    color: '#444',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    width: '100%',
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#faf8f6',
  },
  toggleBtnSelected: {
    borderColor: MAROON,
    backgroundColor: '#f2e7e5',
  },
  toggleText: {
    color: '#666',
    fontWeight: '600',
  },
  toggleTextSelected: {
    color: MAROON,
  },
});

export default RegistrationScreen; 
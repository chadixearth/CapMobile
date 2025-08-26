import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerUser } from '../../services/authService';
import BackButton from '../../components/BackButton';  


const MAROON = '#6B2E2B';
const BG = '#F5F5F5';
const TEXT = '#1F1F1F';
const MUTED = '#666';
const BORDER = '#CFCFCF';
const INPUT_BG = '#FFFFFF';

const RegistrationScreen = ({ navigation, route }) => {
  const role = route?.params?.role || 'tourist';

  // Core fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Common profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [phone, setPhone]         = useState('');

  // Driver
  const [licenseNumber, setLicenseNumber] = useState('');
  const [ownsTartanilla, setOwnsTartanilla] = useState(false);
  const [ownedCount, setOwnedCount] = useState('0');

  // Owner
  const [businessName, setBusinessName] = useState('');
  const [businessPermit, setBusinessPermit] = useState('');
  const [drivesOwnTartanilla, setDrivesOwnTartanilla] = useState(false);

  // UI state
  const [agree, setAgree] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleRegister = async () => {
    setError('');
    setSuccess('');

    if (!agree) {
      setError('Please agree with Terms & Conditions.');
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError('Please enter email, password, and confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate role extras
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

    const validRoles = ['tourist', 'driver', 'owner'];
    if (!validRoles.includes(role)) {
      setError(`Invalid role. Please select: ${validRoles.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      let additionalData = {};
      if (role === 'driver') {
        additionalData = {
          first_name: firstName,
          last_name:  lastName,
          phone,
          license_number: licenseNumber,
          owns_tartanilla: !!ownsTartanilla,
          owned_count: ownsTartanilla ? Math.max(0, parseInt(ownedCount, 10) || 0) : 0,
        };
      } else if (role === 'owner') {
        additionalData = {
          first_name: firstName,
          last_name:  lastName,
          phone,
          business_name: businessName,
          business_permit: businessPermit,
          drives_own_tartanilla: !!drivesOwnTartanilla,
        };
      } else {
        additionalData = {
          first_name: firstName,
          last_name:  lastName,
        };
      }

      const result = await registerUser(email, password, role, additionalData);
      setLoading(false);

      if (result.success) {
        setSuccess(result.message || 'Registration successful!');
        const okAction = () => navigation.navigate('Login');

        if (result.status === 'pending_approval') {
          Alert.alert(
            'Registration Submitted',
            result.message || `Your ${role} registration has been submitted for admin approval. You will receive an email confirmation once approved.`,
            [{ text: 'OK', onPress: okAction }],
            { cancelable: false }
          );
        } else {
          Alert.alert(
            'Registration Successful',
            result.message || 'Please check your email to verify your account.',
            [{ text: 'OK', onPress: okAction }],
            { cancelable: false }
          );
        }
      } else {
        setError(result.error || 'Registration failed.');
      }
    } catch (e) {
      setLoading(false);
      setError('Network error. Please try again.');
      console.error('Registration error:', e);
    }
  };

  // Render helper for pill input
  const PillInput = (props) => (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor="#9B9B9B"
    />
  );

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
        {/* Top back button */}
        {/* ✅ Top bar with same BackButton as Login */}
        <View style={styles.topBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        {/* Title + subtitle */}
        <Text style={styles.title}>Register as {role.charAt(0).toUpperCase() + role.slice(1)}</Text>
        {role === 'tourist' ? (
          <Text style={styles.subtitle}>You will receive an email verification link after registration.</Text>
        ) : (
          <Text style={styles.subtitle}>Your registration will be submitted for admin approval.</Text>
        )}

        {/* Fields */}
        {role === 'tourist' && (
          <>
            <PillInput placeholder="Last Name"  value={lastName}  onChangeText={setLastName} />
            <PillInput placeholder="First Name" value={firstName} onChangeText={setFirstName} />
            <PillInput placeholder="Email"      value={email}     onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <PillInput placeholder="Password"   value={password}  onChangeText={setPassword} secureTextEntry />
            <PillInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          </>
        )}

        {(role === 'driver' || role === 'owner') && (
          <>
            <PillInput placeholder="First Name" value={firstName} onChangeText={setFirstName} />
            <PillInput placeholder="Last Name"  value={lastName}  onChangeText={setLastName} />
            <PillInput placeholder="Email"      value={email}     onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <PillInput placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <PillInput placeholder="Password"   value={password}  onChangeText={setPassword} secureTextEntry />
            <PillInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          </>
        )}

        {role === 'driver' && (
          <>
            <PillInput placeholder="License Number" value={licenseNumber} onChangeText={setLicenseNumber} />
            <Text style={styles.smallLabel}>Do you also own a tartanilla?</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, ownsTartanilla && styles.toggleSelected]}
                onPress={() => setOwnsTartanilla(true)}
              >
                <Text style={[styles.toggleText, ownsTartanilla && styles.toggleTextSelected]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !ownsTartanilla && styles.toggleSelected]}
                onPress={() => setOwnsTartanilla(false)}
              >
                <Text style={[styles.toggleText, !ownsTartanilla && styles.toggleTextSelected]}>No</Text>
              </TouchableOpacity>
            </View>
            {ownsTartanilla && (
              <PillInput
                placeholder="How many tartanillas do you own?"
                value={ownedCount}
                onChangeText={setOwnedCount}
                keyboardType="number-pad"
              />
            )}
          </>
        )}

        {role === 'owner' && (
          <>
            <PillInput placeholder="Business Name" value={businessName} onChangeText={setBusinessName} />
            <PillInput placeholder="Business Permit Number" value={businessPermit} onChangeText={setBusinessPermit} />
            <Text style={styles.smallLabel}>Do you also drive your tartanilla?</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, drivesOwnTartanilla && styles.toggleSelected]}
                onPress={() => setDrivesOwnTartanilla(true)}
              >
                <Text style={[styles.toggleText, drivesOwnTartanilla && styles.toggleTextSelected]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !drivesOwnTartanilla && styles.toggleSelected]}
                onPress={() => setDrivesOwnTartanilla(false)}
              >
                <Text style={[styles.toggleText, !drivesOwnTartanilla && styles.toggleTextSelected]}>No</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Agree to Terms */}
        <View style={styles.termsRow}>
          <TouchableOpacity
            onPress={() => setAgree(!agree)}
            style={[styles.checkbox, { backgroundColor: agree ? MAROON : '#FFFFFF', borderColor: BORDER, borderWidth: agree ? 0 : 1 }]}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agree }}
            accessibilityLabel="Agree to Terms and Conditions"
          >
            {agree && <Ionicons name="checkmark" size={16} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.termsText}>
            Agree with{' '}
            <Text style={styles.termsLink} onPress={() => setShowTC(true)}>
              Terms & Conditions
            </Text>
          </Text>
        </View>

        {/* Errors / success */}
        {error   ? <Text style={styles.error}>{error}</Text>     : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {/* Register button */}
        <TouchableOpacity
          style={[styles.registerBtn, (loading || !agree) && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading || !agree}
          activeOpacity={0.85}
        >
          <Text style={styles.registerText}>{loading ? 'Registering...' : 'Register'}</Text>
        </TouchableOpacity>

        {/* Already have account */}
        <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.8}>
          <Text style={styles.haveAccount}>
            Already have an account? <Text style={styles.haveAccountLink}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Terms & Conditions Modal */}
      <Modal
        visible={showTC}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTC(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setShowTC(false)} style={styles.modalCloseBtn} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
                <Ionicons name="close" size={22} color={TEXT} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Replace with your real T&C text */}
              <Text style={styles.tcParagraph}>
                Welcome to TarTrack. By creating an account, you agree to comply with these Terms & Conditions.
                Please read them carefully.
              </Text>
              <Text style={styles.tcHeading}>1. Account</Text>
              <Text style={styles.tcParagraph}>
                You are responsible for safeguarding your password and for any activities or actions under your account.
              </Text>
              <Text style={styles.tcHeading}>2. Data & Privacy</Text>
              <Text style={styles.tcParagraph}>
                We process your personal data in accordance with our Privacy Policy. You consent to the collection and
                processing of your information for registration, verification, and service delivery.
              </Text>
              <Text style={styles.tcHeading}>3. Acceptable Use</Text>
              <Text style={styles.tcParagraph}>
                Do not misuse the service. You agree not to engage in fraudulent activities or violate applicable laws.
              </Text>
              <Text style={styles.tcHeading}>4. Role-Specific Requirements</Text>
              <Text style={styles.tcParagraph}>
                Drivers and Owners may be required to submit additional documents for verification (e.g., license,
                business permits). Providing inaccurate information may lead to account suspension.
              </Text>
              <Text style={styles.tcHeading}>5. Changes</Text>
              <Text style={styles.tcParagraph}>
                We may update these terms from time to time. Continued use after updates constitutes acceptance.
              </Text>
              <Text style={styles.tcParagraph}>
                If you do not agree with these terms, please decline and do not proceed with registration.
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.declineBtn]}
                onPress={() => { setShowTC(false); setAgree(false); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.footerBtnText, { color: TEXT }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.acceptBtn]}
                onPress={() => { setAgree(true); setShowTC(false); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.footerBtnText, { color: '#fff' }]}>Accept & Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

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
    marginBottom: 60,
    marginLeft: -8, 
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEFEF',
    alignSelf: 'flex-start',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 50,
  },

  input: {
    width: '100%',
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
    marginBottom: 14,
  },

  smallLabel: {
    width: '100%',
    color: TEXT,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
  },

  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 10,
    backgroundColor: INPUT_BG,
    alignItems: 'center',
  },
  toggleSelected: {
    borderColor: MAROON,
    backgroundColor: '#F3E9E8',
  },
  toggleText: {
    color: MUTED,
    fontWeight: '600',
  },
  toggleTextSelected: {
    color: MAROON,
    fontWeight: '700',
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 10,
    marginLeft: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: MAROON,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    color: TEXT,
  },
  termsLink: {
    color: MAROON,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  error: {
    color: '#D92D20',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  success: {
    color: 'green',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },

  registerBtn: {
    backgroundColor: MAROON,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 40,
  },
  registerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  haveAccount: {
    textAlign: 'center',
    color: TEXT,
    fontSize: 14,
    marginTop: 14,
  },
  haveAccountLink: {
    color: MAROON,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'left',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  tcHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginTop: 14,
    marginBottom: 6,
  },
  tcParagraph: {
    color: '#3A3A3A',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  footerBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#EFEFEF',
  },
  acceptBtn: {
    backgroundColor: MAROON,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RegistrationScreen;

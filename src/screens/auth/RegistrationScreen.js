import React, { useState, useRef } from 'react';
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
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerUser } from '../../services/authService';
import BackButton from '../../components/BackButton';
import { colors, spacing, card } from '../../styles/global';
import { useError } from '../../components/ErrorProvider';
import ErrorHandlingService from '../../services/errorHandlingService';

const RegistrationScreen = ({ navigation, route }) => {
  const role = route?.params?.role || 'tourist';
  const { showError, showSuccess } = useError();

  // Set navigation reference for error handling
  React.useEffect(() => {
    ErrorHandlingService.setNavigationRef(navigation);
  }, [navigation]);

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
  const [loading, setLoading] = useState(false);
  // Removed error and success states - using ErrorProvider instead

  const handleRegister = async () => {
    if (!agree) {
      showError('Please agree with Terms & Conditions.', {
        title: 'Terms Required',
        type: 'warning',
      });
      return;
    }

    // Email is always required
    if (!email) {
      showError('Please enter your email address.', {
        title: 'Email Required',
        type: 'warning',
      });
      return;
    }

    // Password validation - required for tourists, optional for driver/owner
    if (role === 'tourist') {
      if (!password || !confirmPassword) {
        showError('Please enter password and confirm your password.', {
          title: 'Password Required',
          type: 'warning',
        });
        return;
      }
      if (password !== confirmPassword) {
        showError('Passwords do not match.', {
          title: 'Password Mismatch',
          type: 'warning',
        });
        return;
      }
    } else {
      // For driver/owner, password is optional but if provided must match
      if ((password || confirmPassword) && password !== confirmPassword) {
        showError('Passwords do not match.', {
          title: 'Password Mismatch',
          type: 'warning',
        });
        return;
      }
    }

    // Validate role-specific required fields
    if (role === 'driver' || role === 'owner') {
      if (!firstName || !lastName || !phone) {
        showError('Please fill in all required fields.', {
          title: 'Missing Information',
          type: 'warning',
        });
        return;
      }
      if (role === 'driver' && !licenseNumber) {
        showError('License number is required for drivers.', {
          title: 'License Required',
          type: 'warning',
        });
        return;
      }
      if (role === 'owner' && !businessName) {
        showError('Business name is required for owners.', {
          title: 'Business Information Required',
          type: 'warning',
        });
        return;
      }
    }

    const validRoles = ['tourist', 'driver', 'owner'];
    if (!validRoles.includes(role)) {
      showError(`Invalid role. Please select: ${validRoles.join(', ')}`, {
        title: 'Invalid Role',
        type: 'error',
      });
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
          drives_own_tartanilla: !!drivesOwnTartanilla,
        };
      } else {
        additionalData = {
          first_name: firstName,
          last_name:  lastName,
        };
      }

      const result = await registerUser(
        email, 
        role === 'tourist' ? password : null,
        role, 
        additionalData
      );
      setLoading(false);

      if (result.success) {
        const okAction = () => navigation.navigate('Login');

        if (result.status === 'pending_approval') {
          const approvalMessage = password 
            ? `Your ${role} registration has been submitted for admin approval. You will receive an email confirmation once approved.`
            : `Your ${role} registration has been submitted for admin approval. A secure password will be generated and emailed to you upon approval.`;
          
          Alert.alert(
            'Application Submitted',
            result.message || approvalMessage,
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
        ErrorHandlingService.handleError(result.error || 'Registration failed.');
      }
    } catch (e) {
      setLoading(false);
      ErrorHandlingService.handleNetworkError('network_error', {
        customMessage: 'Network error. Please check your connection and try again.',
      });
      console.error('Registration error:', e);
    }
  };
  const scrollRef = useRef(null);
  const inputRefs = useRef({});

  const ModernInput = ({ label, ...props }) => (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        {...props}
        style={[styles.modernInput, props.style]}
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        autoComplete="off"
      />
    </View>
  );

  // Render helper for section with icon
  const SectionHeader = ({ icon, title, subtitle }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconContainer}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.sectionTextContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
        {/* Header with back button */}
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.roleIconContainer}>
            <Ionicons 
              name={role === 'tourist' ? 'person' : role === 'driver' ? 'car' : 'business'} 
              size={32} 
              color={colors.primary} 
            />
          </View>
          <Text style={styles.title}>Join as {role.charAt(0).toUpperCase() + role.slice(1)}</Text>
          <Text style={styles.subtitle}>
            {role === 'tourist' 
              ? 'Create your account to start booking rides'
              : 'Submit your application for admin approval'
            }
          </Text>
        </View>

        {/* Registration Form */}
        <View style={styles.formContainer}>
          {/* Tourist Fields */}
          {role === 'tourist' && (
            <>
              <SectionHeader 
                icon="person-outline" 
                title="Personal Information" 
                subtitle="Enter your basic details"
              />
              <ModernInput 
                label="First Name" 
                placeholder="Enter your first name" 
                value={firstName} 
                onChangeText={setFirstName}
                refKey="firstName"
                nextField="lastName"
                autoCapitalize="words"
              />
              <ModernInput 
                label="Last Name" 
                placeholder="Enter your last name" 
                value={lastName} 
                onChangeText={setLastName}
                refKey="lastName"
                nextField="email"
                autoCapitalize="words"
              />
              <ModernInput 
                label="Email Address" 
                placeholder="Enter your email" 
                value={email} 
                onChangeText={setEmail}
                refKey="email"
                nextField="password"
                autoCapitalize="none" 
                keyboardType="email-address"
              />
              
              <SectionHeader 
                icon="lock-closed-outline" 
                title="Security" 
                subtitle="Create a secure password"
              />
              <ModernInput 
                label="Password" 
                placeholder="Enter your password" 
                value={password} 
                onChangeText={setPassword}
                refKey="password"
                nextField="confirmPassword"
                secureTextEntry
              />
              <ModernInput 
                label="Confirm Password" 
                placeholder="Re-enter your password" 
                value={confirmPassword} 
                onChangeText={setConfirmPassword}
                refKey="confirmPassword"
                secureTextEntry
              />
            </>
          )}

          {/* Driver/Owner Fields */}
          {(role === 'driver' || role === 'owner') && (
            <>
              <SectionHeader 
                icon="person-outline" 
                title="Personal Information" 
                subtitle="Enter your basic details"
              />
              <ModernInput 
                label="First Name" 
                placeholder="Enter your first name" 
                value={firstName} 
                onChangeText={setFirstName}
                refKey="firstName"
                nextField="lastName"
                autoCapitalize="words"
              />
              <ModernInput 
                label="Last Name" 
                placeholder="Enter your last name" 
                value={lastName} 
                onChangeText={setLastName}
                refKey="lastName"
                nextField="email"
                autoCapitalize="words"
              />
              <ModernInput 
                label="Email Address" 
                placeholder="Enter your email" 
                value={email} 
                onChangeText={setEmail}
                refKey="email"
                nextField="phone"
                autoCapitalize="none" 
                keyboardType="email-address"
              />
              <ModernInput 
                label="Phone Number" 
                placeholder="Enter your phone number" 
                value={phone} 
                onChangeText={setPhone}
                refKey="phone"
                nextField={role === 'driver' ? 'license' : 'business'}
                keyboardType="phone-pad"
              />
            </>
          )}

          {/* Driver Specific Fields */}
          {role === 'driver' && (
            <>
              <SectionHeader 
                icon="car-outline" 
                title="Driver Information" 
                subtitle="Professional driving details"
              />
              <ModernInput 
                label="Driver's License Number" 
                placeholder="Enter your license number" 
                value={licenseNumber} 
                onChangeText={setLicenseNumber}
                refKey="license"
                nextField={ownsTartanilla ? 'ownedCount' : null}
                autoCapitalize="characters"
              />
              
              <View style={styles.questionContainer}>
                <Text style={styles.questionLabel}>Do you also own a tartanilla?</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[styles.toggleOption, ownsTartanilla && styles.toggleSelected]}
                    onPress={() => setOwnsTartanilla(true)}
                  >
                    <Ionicons 
                      name={ownsTartanilla ? "checkmark-circle" : "ellipse-outline"} 
                      size={20} 
                      color={ownsTartanilla ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[styles.toggleText, ownsTartanilla && styles.toggleTextSelected]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, !ownsTartanilla && styles.toggleSelected]}
                    onPress={() => setOwnsTartanilla(false)}
                  >
                    <Ionicons 
                      name={!ownsTartanilla ? "checkmark-circle" : "ellipse-outline"} 
                      size={20} 
                      color={!ownsTartanilla ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[styles.toggleText, !ownsTartanilla && styles.toggleTextSelected]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {ownsTartanilla && (
                <ModernInput 
                  label="Number of Tartanillas Owned" 
                  placeholder="Enter number" 
                  value={ownedCount} 
                  onChangeText={setOwnedCount}
                  refKey="ownedCount"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              )}
            </>
          )}

          {/* Owner Specific Fields */}
          {role === 'owner' && (
            <>
              <SectionHeader 
                icon="business-outline" 
                title="Business Information" 
                subtitle="Enter your business details"
              />
              <ModernInput 
                label="Business Name" 
                placeholder="Enter your business name" 
                value={businessName} 
                onChangeText={setBusinessName}
                refKey="business"
                autoCapitalize="words"
              />
              
              <View style={styles.questionContainer}>
                <Text style={styles.questionLabel}>Do you also drive your tartanilla?</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[styles.toggleOption, drivesOwnTartanilla && styles.toggleSelected]}
                    onPress={() => setDrivesOwnTartanilla(true)}
                  >
                    <Ionicons 
                      name={drivesOwnTartanilla ? "checkmark-circle" : "ellipse-outline"} 
                      size={20} 
                      color={drivesOwnTartanilla ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[styles.toggleText, drivesOwnTartanilla && styles.toggleTextSelected]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, !drivesOwnTartanilla && styles.toggleSelected]}
                    onPress={() => setDrivesOwnTartanilla(false)}
                  >
                    <Ionicons 
                      name={!drivesOwnTartanilla ? "checkmark-circle" : "ellipse-outline"} 
                      size={20} 
                      color={!drivesOwnTartanilla ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[styles.toggleText, !drivesOwnTartanilla && styles.toggleTextSelected]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Terms and Conditions */}
          <SectionHeader 
            icon="document-text-outline" 
            title="Terms & Conditions" 
            subtitle="Please review and accept our terms"
          />
          
          <TouchableOpacity 
            style={styles.termsContainer}
            onPress={() => setAgree(!agree)}
            activeOpacity={0.8}
          >
            <View style={styles.checkboxContainer}>
              <Ionicons 
                name={agree ? "checkmark-circle" : "ellipse-outline"} 
                size={24} 
                color={agree ? colors.primary : colors.textSecondary} 
              />
            </View>
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsMainText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => setShowTC(true)}>
                  Terms & Conditions
                </Text>
              </Text>
              <Text style={styles.termsSubtext}>
                By registering, you accept our terms of service and privacy policy
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Register Button */}
        <TouchableOpacity
          style={[styles.registerButton, (loading || !agree) && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading || !agree}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            {loading && (
              <View style={styles.loadingContainer}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </View>
            )}
            <Text style={styles.registerButtonText}>
              {loading ? 'Creating Account...' : `Register as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
              Sign In
            </Text>
          </Text>
        </View>
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
                <Ionicons name="close" size={22} color={colors.text} />
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
                {"\n\n"}
                Driver and Owner registrations require admin approval. Upon approval, you will receive login credentials via email.
                You may optionally provide your own password during registration, or have a secure password generated for you.
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
                <Text style={[styles.footerBtnText, { color: colors.text }]}>Decline</Text>
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
    </ScrollView>
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
    paddingBottom: spacing.xl,
  },
  
  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
  },
  
  // Welcome Section
  welcomeSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  roleIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...card,
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  
  // Form Container
  formContainer: {
    gap: spacing.lg,
  },
  
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  
  // Input Styles
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    marginLeft: 4,
  },
  modernInput: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    color: colors.text,
    ...card,
    shadowOpacity: 0.03,
    shadowRadius: 4,
    minHeight: 56,
  },
  
  // Question/Toggle Styles
  questionContainer: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...card,
    shadowOpacity: 0.03,
  },
  questionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 60,
  },
  toggleSelected: {
    backgroundColor: `${colors.primary}10`,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleTextSelected: {
    color: colors.primary,
  },
  
  // Terms & Conditions
  termsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...card,
    shadowOpacity: 0.03,
  },
  checkboxContainer: {
    marginRight: spacing.md,
    paddingTop: 2,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsMainText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    lineHeight: 24,
  },
  termsSubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  
  // Register Button
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 22,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    ...card,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    minHeight: 70,
  },
  registerButtonDisabled: {
    backgroundColor: colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingContainer: {
    transform: [{ rotate: '360deg' }],
  },
  registerButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  
  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  footerText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },

  
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '85%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.md,
    ...card,
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tcHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  tcParagraph: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  footerBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    ...card,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  footerBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RegistrationScreen;

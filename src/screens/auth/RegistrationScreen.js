import React, { useState, useRef, useEffect, memo } from 'react';
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
  Animated,
  Easing,
  LayoutAnimation,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerUser } from '../../services/authService';
import BackButton from '../../components/BackButton';
import { colors, spacing, card } from '../../styles/global';
import { useError } from '../../components/ErrorProvider';
import ErrorHandlingService from '../../services/errorHandlingService';

const ACCENT = '#6B2E2B';

const ROLE_META = {
  tourist: {
    icon: 'person',
    label: 'Tourist',
    subtitle: 'Create an account to start booking rides',
  },
  driver: {
    icon: 'horse-variant',
    label: 'Cochero',
    subtitle: 'Apply to drive a tartanilla',
  },
  owner: {
    icon: 'business',
    label: 'Owner',
    subtitle: 'Offer your tartanilla for rent',
  },
};

/* =========================================================
   ModernInput (memoized) — refined visual
   ========================================================= */
const ModernInput = memo(function ModernInput({
  label,
  nextField,
  registerRef,
  onFocusScroll,
  style,
  styles,
  ACCENT,
  colors,
  leftIcon, // optional Ionicons name
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const localRef = useRef(null);

  return (
    <View style={styles.fieldWrap}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View
        style={[
          styles.inputSurface,
          isFocused && { borderColor: ACCENT + '80', shadowOpacity: 0.15 },
          style,
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={isFocused ? ACCENT : colors.textSecondary}
            style={{ marginRight: 10, marginLeft: 2 }}
          />
        ) : null}

        <TextInput
          {...props}
          ref={(ref) => {
            localRef.current = ref;
            registerRef?.(ref);
          }}
          style={[styles.modernInput]}
          placeholderTextColor={colors.textSecondary}
          selectionColor={ACCENT}
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          underlineColorAndroid="transparent"
          blurOnSubmit={false}
          returnKeyType={nextField ? 'next' : 'done'}
          onFocus={() => {
            setIsFocused(true);
            onFocusScroll?.(localRef.current);
          }}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={() => {
            if (typeof nextField === 'function') nextField();
            else Keyboard.dismiss();
          }}
        />
      </View>
    </View>
  );
});

/* =========================================================
   Registration Screen
   ========================================================= */
const RegistrationScreen = ({ navigation, route }) => {
  const role = route?.params?.role || 'tourist';
  const { icon: heroIcon, label: heroLabel, subtitle: heroSubtitle } =
    ROLE_META[role] ?? ROLE_META.tourist;

  const { showError } = useError();

  useEffect(() => {
    ErrorHandlingService.setNavigationRef(navigation);
  }, [navigation]);

  // ===== Data =====
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [phone, setPhone]         = useState('');

  // Driver
  const [licenseNumber, setLicenseNumber] = useState('');
  const [ownsTartanilla, setOwnsTartanilla] = useState(false);
  const [ownedCount, setOwnedCount] = useState('0');

  // Owner
  const [businessName, setBusinessName] = useState('');
  const [businessPermit, setBusinessPermit] = useState(''); // kept for future use
  const [drivesOwnTartanilla, setDrivesOwnTartanilla] = useState(false);

  // Notification preference (driver/owner only)
  const [notificationPreference, setNotificationPreference] = useState('email');
  
  // Verification method for tourists
  const [verificationMethod, setVerificationMethod] = useState('email');

  // UI
  const [agree, setAgree] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [loading, setLoading] = useState(false);

  // ===== Stepper (Fabric-safe animations) =====
  const isFabric = global?.nativeFabricUIManager != null;
  const canUseLayoutAnimation = Platform.OS === 'ios' && !isFabric;
  const withLayoutAnimation = (cb) => {
    if (canUseLayoutAnimation) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    cb?.();
  };

  const [step, setStep] = useState(1);
  const goNext = () => withLayoutAnimation(() => setStep(2));
  const goBackStep = () => withLayoutAnimation(() => setStep(1));

  // Pending-approval modal (driver/owner)
  const [pendingVisible, setPendingVisible] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pendingVisible) {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spin.stopAnimation();
      spin.setValue(0);
    }
  }, [pendingVisible, spin]);
  const spinStyle = {
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  const handleRegister = async () => {
    if (!agree) {
      showError('Please agree to the Terms & Conditions.', { title: 'Terms Required', type: 'warning' });
      return;
    }
    
    // Trim all inputs to prevent whitespace-only values
    const trimmedEmail = (email || '').trim();
    const trimmedPassword = (password || '').trim();
    const trimmedConfirmPassword = (confirmPassword || '').trim();
    const trimmedFirstName = (firstName || '').trim();
    const trimmedLastName = (lastName || '').trim();
    const trimmedPhone = (phone || '').trim();
    const trimmedLicenseNumber = (licenseNumber || '').trim();
    const trimmedBusinessName = (businessName || '').trim();
    
    if (!trimmedEmail) {
      showError('Please enter your email address.', { title: 'Email Required', type: 'warning' });
      return;
    }

    if (role === 'tourist') {
      if (!trimmedPassword || !trimmedConfirmPassword) {
        showError('Please create and confirm your password.', { title: 'Password Required', type: 'warning' });
        return;
      }
      if (trimmedPassword !== trimmedConfirmPassword) {
        showError('Passwords do not match.', { title: 'Password Mismatch', type: 'warning' });
        return;
      }
      // Validate phone number if SMS verification is chosen
      if (verificationMethod === 'phone' && !trimmedPhone) {
        showError('Phone number is required for SMS verification.', { title: 'Phone Required', type: 'warning' });
        return;
      }
    } else if ((trimmedPassword || trimmedConfirmPassword) && trimmedPassword !== trimmedConfirmPassword) {
      showError('Passwords do not match.', { title: 'Password Mismatch', type: 'warning' });
      return;
    }

    if (role === 'driver' || role === 'owner') {
      if (!trimmedFirstName || !trimmedLastName || !trimmedPhone) {
        showError('Please fill in all required fields.', { title: 'Missing Information', type: 'warning' });
        return;
      }
      if (role === 'driver' && !trimmedLicenseNumber) {
        showError('License number is required for drivers.', { title: 'License Required', type: 'warning' });
        return;
      }
      if (role === 'owner' && !trimmedBusinessName) {
        showError('Business name is required for owners.', { title: 'Business Information Required', type: 'warning' });
        return;
      }
    }

    const validRoles = ['tourist', 'driver', 'owner'];
    if (!validRoles.includes(role)) {
      showError(`Invalid role. Please select: ${validRoles.join(', ')}`, { title: 'Invalid Role', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      let additionalData = {};
      if (role === 'driver') {
        additionalData = {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: trimmedPhone,
          license_number: trimmedLicenseNumber,
          owns_tartanilla: !!ownsTartanilla,
          owned_count: ownsTartanilla ? Math.max(0, parseInt(ownedCount, 10) || 0) : 0,
          preferred_notification: notificationPreference,
        };
      } else if (role === 'owner') {
        additionalData = {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: trimmedPhone,
          business_name: trimmedBusinessName,
          drives_own_tartanilla: !!drivesOwnTartanilla,
          preferred_notification: notificationPreference,
        };
      } else {
        additionalData = { 
          first_name: trimmedFirstName || '', 
          last_name: trimmedLastName || '',
          phone: trimmedPhone || '', // Include phone for SMS verification if needed
          verification_method: verificationMethod
        };
      }

      const result = await registerUser(
        trimmedEmail,
        role === 'tourist' ? trimmedPassword : (trimmedPassword || null),
        role,
        additionalData
      );
      setLoading(false);

      if (result.success) {
        const okAction = () => navigation.navigate('Login');

        if (result.status === 'pending_approval') {
          if (role === 'driver' || role === 'owner') {
            setPendingVisible(true);
          } else {
            const approvalMessage = trimmedPassword
              ? `Your ${role} registration has been submitted for admin approval. You will receive an SMS notification once approved. You can login with the password you provided.`
              : `Your ${role} registration has been submitted for admin approval. A secure password will be generated and sent to your phone via SMS upon approval.`;
            
            Alert.alert(
              'Application Submitted',
              result.message || approvalMessage,
              [{ text: 'OK', onPress: okAction }],
              { cancelable: false }
            );
          }
        } else if (result.status === 'email_verification_required') {
          // Navigate to verification screen for email verification
          navigation.navigate('Verification', {
            email: trimmedEmail,
            verification_method: 'email',
            user: result.user
          });
        } else if (result.status === 'phone_verification_required') {
          // Navigate to verification screen for phone verification
          navigation.navigate('Verification', {
            phone: trimmedPhone,
            verification_method: 'phone',
            user: result.user
          });
        } else if (result.status === 'phone_verification_pending') {
          Alert.alert(
            'Registration Submitted',
            'SMS verification is currently pending. Please contact admin for account activation.',
            [{ text: 'OK', onPress: okAction }],
            { cancelable: false }
          );
        } else {
          Alert.alert(
            'Registration Successful',
            'Your account has been created successfully.',
            [{ text: 'OK', onPress: okAction }],
            { cancelable: false }
          );
        }
      } else {
        if (result.error_type === 'duplicate_email') {
          Alert.alert('Email Already Registered', result.error + '\n\n' + result.suggestion);
        } else if (result.error_type === 'duplicate_phone') {
          Alert.alert('Phone Already Registered', result.error + '\n\n' + result.suggestion);
        } else {
          ErrorHandlingService.handleError(result.error || 'Registration failed.');
        }
      }
    } catch (e) {
      setLoading(false);
      ErrorHandlingService.handleNetworkError('network_error', {
        customMessage: 'Network error. Please check your connection and try again.',
      });
      console.error('Registration error:', e);
    }
  };

  // ===== Keyboard-aware scrolling =====
  const scrollRef = useRef(null);
  const inputRefs = useRef({});
  const scrollOffsetRef = useRef(0); // track current scroll Y

  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKbHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const reg = (key) => (ref) => { if (ref) inputRefs.current[key] = ref; };
  const focus = (key) => () => inputRefs.current[key]?.focus();

  const screenH = Dimensions.get('window').height;
  const scrollToInput = (inputRef) => {
    if (!inputRef || !scrollRef.current) return;
    requestAnimationFrame(() => {
      try {
        inputRef.measureInWindow((x, y, w, h) => {
          const keyboardPadding = 20;
          const visibleBottom = screenH - kbHeight - keyboardPadding;
          const inputBottom = y + h;
          if (inputBottom > visibleBottom) {
            const delta = inputBottom - visibleBottom;
            const nextY = Math.max(0, scrollOffsetRef.current + delta + 12);
            scrollRef.current.scrollTo({ y: nextY, animated: true });
          }
        });
      } catch {}
    });
  };

  const keyboardOffset = Platform.select({ ios: 0, android: 0 });
  const isKeyboardOpen = kbHeight > 0;

  // footer slide animation
  const footerAnim = useRef(new Animated.Value(1)).current; // 1 visible, 0 hidden
  useEffect(() => {
    Animated.timing(footerAnim, {
      toValue: isKeyboardOpen ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isKeyboardOpen, footerAnim]);

  const SectionHeader = ({ icon, title, subtitle }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconContainer}>
        <Ionicons name={icon} size={18} color={ACCENT} />
      </View>
      <View style={styles.sectionTextContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  const ProgressPills = () => (
    <View style={styles.pillsRow}>
      <View style={[styles.pill, step === 1 ? styles.pillActive : styles.pillInactive]} />
      <View style={[styles.pill, step === 2 ? styles.pillActive : styles.pillInactive]} />
    </View>
  );

  const primaryLabel =
    step === 1 ? 'Next' :
    loading ? 'Creating Account...' : `Register as ${role}`;

  const primaryOnPress = step === 1 ? goNext : handleRegister;
  const primaryDisabled = step === 1 ? false : (loading || !agree);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: isKeyboardOpen ? spacing.md : spacing.xl * 6 }, // reduce padding while typing
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        nestedScrollEnabled
        onScroll={(e) => { // track current offset
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets={true} // iOS: prevent content jump
      >
        {/* Minimal app bar */}
        <View style={styles.appBar}>
          <View style={[styles.backCircle, { backgroundColor: ACCENT }]}>
            <BackButton onPress={() => navigation.goBack()} color="#fff" />
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroHeader}>
          <View style={styles.heroIconCircle}>
            {role === 'driver' ? (
              <Image 
                source={require('../../../assets/carriage-icon.png')} 
                style={{ width: 26, height: 26 }} 
                resizeMode="contain" 
              />
            ) : (
              <Ionicons name={heroIcon} size={26} color={ACCENT} />
            )}
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={styles.roleChip}>
              <Ionicons name="sparkles-outline" size={14} color={ACCENT} />
              <Text style={[styles.roleChipText, { color: ACCENT }]}>{heroLabel}</Text>
            </View>
            <Text style={styles.heroTitle}>Join as {heroLabel}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          </View>
        </View>

        {/* ====== STEP 1 ====== */}
        {step === 1 && (
          <View style={styles.sectionSurface}>
            <SectionHeader icon="person-outline" title="Personal Information" subtitle="Tell us about you" />

            {role === 'tourist' && (
              <>
                <ModernInput
                  leftIcon="person-outline"
                  placeholder="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  registerRef={reg('firstName')}
                  nextField={focus('lastName')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="words"
                />
                <ModernInput
                  leftIcon="person-circle-outline"
                  placeholder="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  registerRef={reg('lastName')}
                  nextField={focus('email')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="words"
                />
                <ModernInput
                  leftIcon="mail-outline"
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  registerRef={reg('email')}
                  nextField={verificationMethod === 'phone' ? focus('phone') : undefined}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                
                {/* Verification Method Selection */}
                <View style={styles.questionBox}>
                  <Text style={styles.questionTitle}>How would you like to verify your account?</Text>
                  <Text style={styles.questionSubtitle}>Choose your preferred verification method</Text>
                  <View style={styles.notificationOptions}>
                    <TouchableOpacity
                      style={[styles.notificationOption, verificationMethod === 'email' && styles.notificationOptionSelected]}
                      onPress={() => setVerificationMethod('email')}
                      activeOpacity={0.9}
                    >
                      <Ionicons 
                        name={verificationMethod === 'email' ? 'radio-button-on' : 'radio-button-off'} 
                        size={18} 
                        color={verificationMethod === 'email' ? ACCENT : colors.textSecondary} 
                      />
                      <View style={styles.notificationOptionText}>
                        <Text style={[styles.notificationOptionTitle, verificationMethod === 'email' && { color: ACCENT }]}>Email Verification</Text>
                        <Text style={styles.notificationOptionDesc}>Receive verification link via email</Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.notificationOption, verificationMethod === 'phone' && styles.notificationOptionSelected]}
                      onPress={() => setVerificationMethod('phone')}
                      activeOpacity={0.9}
                    >
                      <Ionicons 
                        name={verificationMethod === 'phone' ? 'radio-button-on' : 'radio-button-off'} 
                        size={18} 
                        color={verificationMethod === 'phone' ? ACCENT : colors.textSecondary} 
                      />
                      <View style={styles.notificationOptionText}>
                        <Text style={[styles.notificationOptionTitle, verificationMethod === 'phone' && { color: ACCENT }]}>SMS Verification</Text>
                        <Text style={styles.notificationOptionDesc}>Receive verification code via text message</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Phone input for SMS verification */}
                {verificationMethod === 'phone' && (
                  <ModernInput
                    leftIcon="call-outline"
                    placeholder="Phone number"
                    value={phone}
                    onChangeText={setPhone}
                    registerRef={reg('phone')}
                    onFocusScroll={scrollToInput}
                    styles={styles}
                    ACCENT={ACCENT}
                    colors={colors}
                    keyboardType="phone-pad"
                  />
                )}
              </>
            )}

            {(role === 'driver' || role === 'owner') && (
              <>
                <ModernInput
                  leftIcon="person-outline"
                  placeholder="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  registerRef={reg('firstName')}
                  nextField={focus('lastName')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="words"
                />
                <ModernInput
                  leftIcon="person-circle-outline"
                  placeholder="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  registerRef={reg('lastName')}
                  nextField={focus('email')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="words"
                />
                <ModernInput
                  leftIcon="mail-outline"
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  registerRef={reg('email')}
                  nextField={focus('phone')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <ModernInput
                  leftIcon="call-outline"
                  placeholder="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  registerRef={reg('phone')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  keyboardType="phone-pad"
                />
              </>
            )}
          </View>
        )}

        {/* ====== STEP 2 ====== */}
        {step === 2 && (
          <View style={styles.sectionSurface}>
            {role === 'tourist' && (
              <>
                <SectionHeader icon="lock-closed-outline" title="Security" subtitle="Create a strong password" />
                <ModernInput
                  leftIcon="key-outline"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  registerRef={reg('password')}
                  nextField={focus('confirmPassword')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  secureTextEntry
                />
                <ModernInput
                  leftIcon="checkmark-done-outline"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  registerRef={reg('confirmPassword')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  secureTextEntry
                />
              </>
            )}

            {role === 'driver' && (
              <>
                <SectionHeader icon="car-outline" title="Driver details" subtitle="We’ll review your application" />
                <ModernInput
                  leftIcon="card-outline"  // safe Ionicons name
                  placeholder="Driver’s license number"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  registerRef={reg('license')}
                  nextField={ownsTartanilla ? focus('ownedCount') : undefined}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="characters"
                />

                <View style={styles.questionBox}>
                  <Text style={styles.questionTitle}>Do you own a tartanilla?</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[styles.toggle, ownsTartanilla && styles.toggleOn]}
                      onPress={() => setOwnsTartanilla(true)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={ownsTartanilla ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ownsTartanilla ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.toggleTxt, ownsTartanilla && styles.toggleTxtOn]}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggle, !ownsTartanilla && styles.toggleOn]}
                      onPress={() => setOwnsTartanilla(false)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={!ownsTartanilla ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={!ownsTartanilla ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.toggleTxt, !ownsTartanilla && styles.toggleTxtOn]}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {ownsTartanilla && (
                  <ModernInput
                    leftIcon="grid-outline"
                    label="How many tartanillas do you own?"
                    placeholder="Enter number"
                    value={ownedCount}
                    onChangeText={setOwnedCount}
                    registerRef={reg('ownedCount')}
                    onFocusScroll={scrollToInput}
                    styles={styles}
                    ACCENT={ACCENT}
                    colors={colors}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                )}
              </>
            )}

            {role === 'owner' && (
              <>
                <SectionHeader icon="business-outline" title="Business details" subtitle="We’ll verify your information" />
                <ModernInput
                  leftIcon="briefcase-outline"  // safe Ionicons name
                  label="Business name"
                  placeholder="Your business name"
                  value={businessName}
                  onChangeText={setBusinessName}
                  registerRef={reg('business')}
                  onFocusScroll={scrollToInput}
                  styles={styles}
                  ACCENT={ACCENT}
                  colors={colors}
                  autoCapitalize="words"
                />

                <View style={styles.questionBox}>
                  <Text style={styles.questionTitle}>Do you also drive your tartanilla?</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[styles.toggle, drivesOwnTartanilla && styles.toggleOn]}
                      onPress={() => setDrivesOwnTartanilla(true)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={drivesOwnTartanilla ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={drivesOwnTartanilla ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.toggleTxt, drivesOwnTartanilla && styles.toggleTxtOn]}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggle, !drivesOwnTartanilla && styles.toggleOn]}
                      onPress={() => setDrivesOwnTartanilla(false)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={!drivesOwnTartanilla ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={!drivesOwnTartanilla ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.toggleTxt, !drivesOwnTartanilla && styles.toggleTxtOn]}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* Notification Preference for Driver/Owner */}
            {(role === 'driver' || role === 'owner') && (
              <View style={styles.questionBox}>
                <Text style={styles.questionTitle}>How would you like to receive your login credentials?</Text>
                <Text style={styles.questionSubtitle}>Choose your preferred notification method</Text>
                <View style={styles.notificationOptions}>
                  <TouchableOpacity
                    style={[styles.notificationOption, notificationPreference === 'email' && styles.notificationOptionSelected]}
                    onPress={() => setNotificationPreference('email')}
                    activeOpacity={0.9}
                  >
                    <Ionicons 
                      name={notificationPreference === 'email' ? 'radio-button-on' : 'radio-button-off'} 
                      size={18} 
                      color={notificationPreference === 'email' ? ACCENT : colors.textSecondary} 
                    />
                    <View style={styles.notificationOptionText}>
                      <Text style={[styles.notificationOptionTitle, notificationPreference === 'email' && { color: ACCENT }]}>Email Only</Text>
                      <Text style={styles.notificationOptionDesc}>Receive credentials via email</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.notificationOption, notificationPreference === 'sms' && styles.notificationOptionSelected]}
                    onPress={() => setNotificationPreference('sms')}
                    activeOpacity={0.9}
                  >
                    <Ionicons 
                      name={notificationPreference === 'sms' ? 'radio-button-on' : 'radio-button-off'} 
                      size={18} 
                      color={notificationPreference === 'sms' ? ACCENT : colors.textSecondary} 
                    />
                    <View style={styles.notificationOptionText}>
                      <Text style={[styles.notificationOptionTitle, notificationPreference === 'sms' && { color: ACCENT }]}>SMS Only</Text>
                      <Text style={styles.notificationOptionDesc}>Receive credentials via text message</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.helperCaption}>Review and accept our terms to continue</Text>
            <TouchableOpacity style={styles.termsRow} onPress={() => setAgree(!agree)} activeOpacity={0.85}>
              <Ionicons
                name={agree ? 'checkbox' : 'square-outline'}
                size={20}
                color={agree ? ACCENT : colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.termsMain}>
                  I agree to the{' '}
                  <Text style={[styles.termsLink, { color: ACCENT }]} onPress={() => { Keyboard.dismiss(); setShowTC(true); }}>
                    Terms & Conditions
                  </Text>
                </Text>
                <Text style={styles.termsSub}>By registering, you accept our terms and privacy policy</Text>
              </View>
            </TouchableOpacity>

            <View style={{ marginTop: 4 }}>
              <TouchableOpacity onPress={goBackStep} activeOpacity={0.8} style={{ paddingVertical: 8 }}>
                <Text style={[styles.backLink, { color: ACCENT }]}>Back to personal info</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom bar — animated hide on keyboard open */}
      {!isKeyboardOpen && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.stickyFooter,
            {
              opacity: footerAnim,
              transform: [
                {
                  translateY: footerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
              paddingBottom: 12 + 18,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              styles.btnLarge,
              primaryDisabled && styles.btnDisabled,
            ]}
            onPress={primaryOnPress}
            disabled={primaryDisabled}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          </TouchableOpacity>

          <Text style={[styles.footerText, { marginTop: 10, textAlign: 'center' }]}>
            Already have an account?{' '}
            <Text
              style={[styles.footerLink, { color: ACCENT }]}
              onPress={() => navigation.navigate('Login')}
            >
              Login
            </Text>
          </Text>

          <ProgressPills />
        </Animated.View>
      )}

      {/* Terms Modal */}
      <Modal visible={showTC} animationType="slide" transparent onRequestClose={() => setShowTC(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setShowTC(false)} style={styles.modalCloseBtn} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.tcParagraph}>Welcome to TarTrack. By creating an account, you agree to comply with these Terms & Conditions. Please read them carefully.</Text>
              <Text style={styles.tcHeading}>1. Account</Text>
              <Text style={styles.tcParagraph}>You are responsible for safeguarding your password and for any activities or actions under your account.</Text>
              <Text style={styles.tcHeading}>2. Data & Privacy</Text>
              <Text style={styles.tcParagraph}>We process your personal data in accordance with our Privacy Policy. You consent to the collection and processing of your information for registration, verification, and service delivery.</Text>
              <Text style={styles.tcHeading}>3. Acceptable Use</Text>
              <Text style={styles.tcParagraph}>Do not misuse the service. You agree not to engage in fraudulent activities or violate applicable laws.</Text>
              <Text style={styles.tcHeading}>4. Role-Specific Requirements</Text>
              <Text style={styles.tcParagraph}>
                Drivers and Owners may be required to submit additional documents for verification (e.g., license, business permits). Providing inaccurate information may lead to account suspension.{'\n\n'}
                Driver and Owner registrations require admin approval. Upon approval, you will receive login credentials via SMS to your registered phone number. You may optionally provide your own password during registration, or have a secure password generated for you.
              </Text>
              <Text style={styles.tcHeading}>5. Changes</Text>
              <Text style={styles.tcParagraph}>We may update these terms from time to time. Continued use after updates constitutes acceptance.</Text>
              <Text style={styles.tcParagraph}>If you do not agree with these terms, please decline and do not proceed with registration.</Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.footerBtn, styles.declineBtn]} onPress={() => { setShowTC(false); setAgree(false); }} activeOpacity={0.85}>
                <Text style={[styles.footerBtnText, { color: colors.text }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.footerBtn, styles.acceptBtn, { backgroundColor: ACCENT }]} onPress={() => { setAgree(true); setShowTC(false); }} activeOpacity={0.85}>
                <Text style={[styles.footerBtnText, { color: '#fff' }]}>Accept & Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pending approval modal */}
      <Modal visible={pendingVisible} transparent animationType="fade" onRequestClose={() => setPendingVisible(false)}>
        <View style={styles.pendingBackdrop}>
          <View style={styles.pendingCard}>
            <Animated.View style={[styles.spinnerWrap, spinStyle]}>
              <Ionicons name="refresh" size={28} color={ACCENT} />
            </Animated.View>
            <Text style={styles.pendingTitle}>Processing</Text>
            <Text style={styles.pendingText}>
              Please wait for admin approval to log in to your account.{'\n'}
              We’ll notify you once you’re approved. Thank you!
            </Text>
            <TouchableOpacity
              onPress={() => { setPendingVisible(false); navigation.navigate('Login'); }}
              style={[styles.primaryBtn, { backgroundColor: ACCENT, marginTop: 12 }]}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // Page
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  // Minimal app bar
  appBar: {
    marginTop: Platform.OS === 'ios' ? 14 : 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backCircle: {
    marginLeft: -20,
    marginTop: 50,
  },
  appBarTitle: {
    fontSize: 14,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // Hero
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginLeft: 50,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  roleChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: ACCENT + '12',
    borderWidth: 1,
    borderColor: ACCENT + '33',
    marginBottom: 6,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroIconCircle: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00000008',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionIconContainer: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: `${ACCENT}15`,
    borderWidth: 1, borderColor: `${ACCENT}33`,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  sectionTextContainer: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: colors.textSecondary },

  // Section surface (card-like container)
  sectionSurface: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    ...card,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    marginTop: 8,
  },

  // Inputs
  fieldWrap: { marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  inputSurface: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    ...card,
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  modernInput: {
    flex: 1,
    paddingVertical: 1,
    fontSize: 15,
    color: colors.text,
  },

  // Toggle block
  questionBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: colors.background, padding: 12, marginTop: 6,
  },
  questionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 10 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingVertical: 12, gap: 6,
    backgroundColor: colors.card,
  },
  toggleOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  toggleTxt: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  toggleTxtOn: { color: '#fff' },

  // Terms
  helperCaption: { fontSize: 11, color: colors.textSecondary, marginTop: 8, marginBottom: 6 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, paddingHorizontal: 0, marginBottom: 4 },
  termsMain: { fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 18 },
  termsSub: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  termsLink: { fontWeight: '800', textDecorationLine: 'underline' },

  // Buttons
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  btnLarge: { marginTop: 6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  btnDisabled: { backgroundColor: colors.textSecondary },

  // Progress
  pillsRow: { flexDirection: 'row', gap: 8, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  pill: { height: 6, borderRadius: 999, width: 54 },
  pillActive: { backgroundColor: ACCENT },
  pillInactive: { backgroundColor: '#00000014' },

  backLink: { fontSize: 12, fontWeight: '800' },

  // Sticky footer (elevated)
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    backgroundColor: colors.background,
  },

  footerText: { fontSize: 13, color: colors.textSecondary },
  footerLink: { fontSize: 13, fontWeight: '900' },

  // T&C modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '85%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tcHeading: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  tcParagraph: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  modalFooter: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  footerBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  acceptBtn: { backgroundColor: ACCENT },
  footerBtnText: { fontSize: 13, fontWeight: '700' },

  // Notification preferences
  questionSubtitle: { fontSize: 11, color: colors.textSecondary, marginBottom: 12, marginTop: 2 },
  notificationOptions: { gap: 8 },
  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  notificationOptionSelected: {
    borderColor: ACCENT + '60',
    backgroundColor: ACCENT + '08',
  },
  notificationOptionText: { marginLeft: 10, flex: 1 },
  notificationOptionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  notificationOptionDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Pending modal
  pendingBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  pendingCard: {
    width: '84%', backgroundColor: colors.card, borderRadius: 16, padding: 18,
    alignItems: 'center', ...card, shadowOpacity: 0.15, shadowRadius: 16,
  },
  spinnerWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: `${ACCENT}10`, marginBottom: 10 },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  pendingText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});

export default RegistrationScreen;

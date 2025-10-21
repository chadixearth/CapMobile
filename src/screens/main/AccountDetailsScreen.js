//ACCOUNT DETAILS SCREEN


import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import EditableField from '../../components/EditableField';
import Button from '../../components/Button';
import BackButton from '../../components/BackButton';
import {
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  changePassword,
} from '../../services/authService';

import MobilePhotoUpload from '../../services/MobilePhotoUpload';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import AccountDeletionHandler from '../../components/AccountDeletionHandler';
import { getUserSettings, updateAnonymousReviewSetting } from '../../services/userSettings';

const { width: SCREEN_W } = Dimensions.get('window');

const COLORS = {
  maroon: '#6B2E2B',
  maroon700: '#531F1D',
  text: '#0F172A',
  muted: '#6B7280',
  border: '#E5E7EB',
  wash: '#F8FAFC',
  white: '#FFFFFF',
  green: '#14532D',
  red: '#B91C1C',
  inkSoft: 'rgba(15,23,42,0.06)',
};

export default function AccountDetailsScreen({ navigation }) {
  const auth = useAuth();
  const scrollRef = useRef(null);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);



  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Privacy settings state
  const [anonymousReviews, setAnonymousReviews] = useState(false);

  // Deactivation modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch user data
  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) {
      const fetchUser = async () => {
        try {
          let authorIdForBio = null;

          const currentUser = await getCurrentUser();
          if (currentUser) {
            const profileResult = await getUserProfile(currentUser.id);
            let userData = currentUser;
            if (profileResult.success && profileResult.data) {
              userData = { ...currentUser, ...profileResult.data };
            }

            authorIdForBio = currentUser.id;
            const fullName = userData.name || userData.full_name || '';
            const nameParts = fullName.split(' ');

            setFirstName(userData.first_name || nameParts[0] || '');
            setMiddleName(userData.middle_name || nameParts[1] || '');
            setLastName(userData.last_name || nameParts[2] || '');
            setEmail(userData.email || '');
            setPhone(userData.phone || '');

            const profilePhotoUrl =
              userData.profile_photo_url ||
              userData.profile_photo ||
              userData.avatar_url ||
              '';
            setPhotoUrl(profilePhotoUrl);
          } else {
            const { data } = await supabase.auth.getUser();
            if (data?.user) {
              authorIdForBio = data.user.id;
              const fullName = data.user.user_metadata?.name || '';
              const nameParts = fullName.split(' ');
              setFirstName(nameParts[0] || '');
              setMiddleName(nameParts[1] || '');
              setLastName(nameParts[2] || '');
              setEmail(data.user.email || '');
              setPhone(data.user.user_metadata?.phone || '');
              const authPhotoUrl =
                data.user.user_metadata?.profile_photo_url ||
                data.user.user_metadata?.profile_photo ||
                '';
              setPhotoUrl(authPhotoUrl);
            }
          }



          if (auth.role === 'tourist') {
            try {
              const settingsResult = await getUserSettings();
              if (settingsResult.success) {
                setAnonymousReviews(settingsResult.data.anonymousReviews || false);
              }
            } catch (err) {
              console.error('Error loading privacy settings:', err);
            }
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user data');
        }
      };
      fetchUser();
    }
  }, [auth.loading, auth.isAuthenticated, auth.user]); // Added auth.user to refresh when profile updates

  if (auth.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }
  if (!auth.isAuthenticated) return null;

  const avatarName = useMemo(() => 
    [firstName, middleName, lastName].filter(Boolean).join(' '), 
    [firstName, middleName, lastName]
  );
  
  const avatarUrl = useMemo(() =>
    photoUrl
      ? photoUrl
      : avatarName
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=6B2E2B&color=fff&size=128`
      : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128',
    [photoUrl, avatarName]
  );

  // Small helpers
  const FullWidthButton = useCallback(({ title, onPress, tone = 'primary', loading }) => {
    const isPrimary = tone === 'primary';
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.95}
        style={[
          styles.fullBtn,
          isPrimary ? styles.fullBtnPrimary : styles.fullBtnGhost,
          loading && { opacity: 0.7 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isPrimary ? '#fff' : COLORS.maroon} />
        ) : (
          <Text style={isPrimary ? styles.fullBtnTextPrimary : styles.fullBtnTextGhost}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  }, []);

  const Banner = useCallback(({ type = 'success', children }) => {
    const isError = type === 'error';
    return (
      <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}>
        <Ionicons
          name={isError ? 'alert-circle' : 'checkmark-circle'}
          size={16}
          color={isError ? COLORS.red : COLORS.green}
          style={{ marginRight: 8 }}
        />
        <Text style={[styles.bannerText, { color: isError ? COLORS.red : COLORS.green }]}>{children}</Text>
      </View>
    );
  }, []);

  const Section = useCallback(({ icon, title, subtitle, children, right }) => (
    <View style={styles.sectionCard} pointerEvents="auto">
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={styles.sectionIconCircle}>
            <Ionicons name={icon} size={16} color={COLORS.maroon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {!!subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
          </View>
        </View>
        {right}
      </View>
      {children}
    </View>
  ), []);

  const handlePickImage = async () => {
    try {
      const photoService = new MobilePhotoUpload();
      const image = await photoService.pickImage();
      if (!image) return;
      await uploadImage(image.uri);
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploading(true);
      setError('');
      setSuccess('');
      const currentUser = await getCurrentUser();

      if (currentUser) {
        const photoService = new MobilePhotoUpload();
        const result = await photoService.uploadProfilePhoto(currentUser.id, uri);
        if (result.success) {
          setPhotoUrl(result.photo_url);
          const profileUpdateResult = await updateUserProfile(currentUser.id, {
            profile_photo_url: result.photo_url,
          });
          if (profileUpdateResult.success) {
            setSuccess('Profile photo updated successfully!');
            // Refresh auth context with updated user data
            if (auth.refreshUser) {
              await auth.refreshUser();
            }
          } else {
            console.warn('Photo uploaded but failed to save to profile:', profileUpdateResult.error);
            setSuccess('Profile photo uploaded!');
          }
        } else {
          throw new Error(result.error || 'Failed to upload photo');
        }
      } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileExt = uri.split('.').pop();
        const fileName = `profile_${Date.now()}.${fileExt}`;
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('User not found');

        const uploadPath = `${userId}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(uploadPath, blob, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(uploadPath);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');

        setPhotoUrl(publicUrlData.publicUrl);
        await supabase.auth.updateUser({ data: { profile_photo_url: publicUrlData.publicUrl } });
        setSuccess('Profile photo updated!');
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err.message || 'Failed to upload photo.';
      setError(errorMessage);
      Alert.alert('Upload Failed', errorMessage, [{ text: 'OK' }]);
    } finally {
      setUploading(false);
    }
  };

  // Web file input
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');
      const currentUser = await getCurrentUser();

      if (currentUser) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const result = await uploadProfilePhoto(currentUser.id, e.target.result);
            if (result.success) {
              setPhotoUrl(result.photoUrl);
              await updateUserProfile(currentUser.id, { profile_photo_url: result.photoUrl });
              setSuccess('Profile photo updated!');
            } else {
              throw new Error(result.error || 'Failed to upload photo');
            }
          } catch (err) {
            setError(err.message || 'Failed to upload photo.');
          } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        reader.readAsDataURL(file);
        return;
      } else {
        const fileExt = file.name.split('.').pop();
        const fileName = `profile_${Date.now()}.${fileExt}`;
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('User not found');

        const uploadPath = `${userId}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(uploadPath, file, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(uploadPath);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');

        setPhotoUrl(publicUrlData.publicUrl);
        await supabase.auth.updateUser({ data: { profile_photo_url: publicUrlData.publicUrl } });
        setSuccess('Profile photo updated!');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const currentUser = await getCurrentUser();

      if (currentUser) {
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
        const profileData = {
          name: fullName,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email,
          phone,
          profile_photo_url: photoUrl,
        };
        Object.keys(profileData).forEach((k) => {
          if (profileData[k] === '' || profileData[k] === null || profileData[k] === undefined) {
            delete profileData[k];
          }
        });
        const result = await updateUserProfile(currentUser.id, profileData);
        if (result.success) {
          setSuccess(result.message || 'Account updated successfully!');
          // Refresh auth context with updated user data
          if (auth.refreshUser) {
            await auth.refreshUser();
          }
        } else {
          setError(result.error || 'Failed to update profile.');
        }
      } else {
        const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
        const updates = { data: { name, phone, profile_photo_url: photoUrl } };
        const { error: metaError } = await supabase.auth.updateUser(updates);
        let emailError = null;
        if (email) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.email !== email) {
            const { error: eError } = await supabase.auth.updateUser({ email });
            emailError = eError;
          }
        }
        if (metaError || emailError) {
          setError(metaError?.message || emailError?.message || 'Failed to update account.');
        } else {
          setSuccess('Account updated successfully!');
        }
      }
    } catch (e) {
      console.error('Save error:', e);
      setError('Failed to save changes.');
    } finally {
      setLoading(false);
    }
  };



  const openDeleteModal = () => {
    setDeleteOpen(true);
  };

  const handleChangePassword = async () => {
    try {
      setChangingPassword(true);
      setPasswordMessage('');

      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordMessage('All fields are required.');
        return;
      }
      if (newPassword.length < 6) {
        setPasswordMessage('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordMessage('New passwords do not match.');
        return;
      }

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setPasswordMessage('You must be logged in to change password.');
        return;
      }

      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        // Handle session expiration
        if (result.session_expired) {
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again to continue.',
            [{ text: 'OK' }],
            { cancelable: false }
          );
        } else {
          // Handle incorrect current password with helpful message
          const errorMsg = result.error || 'Failed to change password.';
          if (errorMsg.includes('Current password is incorrect') || errorMsg.includes('Invalid password') || errorMsg.includes('wrong password')) {
            Alert.alert(
              'Incorrect Password',
              'The current password you entered is incorrect. If you recently changed your password or forgot it, you can use the "Forgot Password" option on the login screen.',
              [
                { text: 'Try Again', style: 'default' },
                { 
                  text: 'Forgot Password', 
                  onPress: () => {
                    Alert.alert(
                      'Reset Password',
                      'To reset your password, please log out and use the "Forgot Password" option on the login screen.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Log Out',
                          style: 'destructive',
                          onPress: () => auth.logout()
                        }
                      ]
                    );
                  }
                }
              ]
            );
          } else {
            setPasswordMessage(errorMsg);
          }
        }
      }
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const currentUser = await getCurrentUser();
      if (currentUser) {
        AccountDeletionHandler.requestDeletion(
          currentUser.id,
          'User requested account deactivation',
          () => auth.logout()
        );
        setDeleteOpen(false);
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to schedule deactivation.');
    } finally {
      setDeleting(false);
    }
  };


  const KAV_BEHAVIOR = Platform.select({ ios: 'padding', android: 'position' });
  const KAV_OFFSET = Platform.select({ ios: 86, android: 0 });

  return (
    <View style={styles.container}>
      {/* Header like MenuScreen */}
      <View style={styles.hero}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Details</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* Floating profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileLeft}>
          {Platform.OS === 'web' ? (
            <>
              <img
                src={avatarUrl}
                alt="Profile"
                style={{
                  width: 60, height: 60, borderRadius: 30,
                  border: `2px solid ${COLORS.maroon}`,
                  objectFit: 'cover',
                }}
              />
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={uploading}
              />
            </>
          ) : (
            <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {avatarName || 'Set your name'}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {email || 'Set your email'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editIconBtn}
          onPress={Platform.OS === 'web' ? () => fileInputRef.current?.click() : handlePickImage}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.maroon} />
          ) : (
            <Ionicons name="camera" size={20} color={COLORS.maroon} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.scrollContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="always"
          removeClippedSubviews={false}
          nestedScrollEnabled
          onStartShouldSetResponderCapture={() => true}
          onResponderTerminationRequest={() => false}
        >

          {/* Feedback */}
          {!!error && <Banner type="error">{error}</Banner>}
          {!!success && <Banner type="success">{success}</Banner>}

          {/* PROFILE & CONTACT */}
          <Section
            icon="person-circle-outline"
            title="Profile & Contact"
            subtitle="Your personal information and contact details"
          >
            <View style={styles.profileContactCard}>
              {/* Name Section */}
              <View style={[styles.profileSection, styles.profileSectionWithBorder]}>
                <View style={styles.profileSectionHeader}>
                  <View style={styles.profileSectionIcon}>
                    <Ionicons name="person" size={14} color={COLORS.maroon} />
                  </View>
                  <Text style={styles.profileSectionTitle}>Personal Information</Text>
                </View>
                
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <EditableField
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First Name"
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <EditableField
                      value={middleName}
                      onChangeText={setMiddleName}
                      placeholder="Middle Name"
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <EditableField
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last Name"
                    />
                  </View>
                  <View style={styles.gridCol} />
                </View>
              </View>

              {/* Contact Section */}
              <View style={styles.profileSection}>
                <View style={styles.profileSectionHeader}>
                  <View style={styles.profileSectionIcon}>
                    <Ionicons name="mail" size={14} color={COLORS.maroon} />
                  </View>
                  <Text style={styles.profileSectionTitle}>Contact Information</Text>
                </View>
                
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <EditableField
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Email Address"
                      keyboardType="email-address"
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <EditableField
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Phone Number"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              <FullWidthButton title={loading ? 'Saving…' : 'Save Changes'} onPress={handleSave} loading={loading} />
            </View>
          </Section>

          {/* SECURITY */}
          <Section
            icon="lock-closed-outline"
            title="Security"
            subtitle="Change your password"
            right={
              <TouchableOpacity
                onPress={() => setShowPasswords(!showPasswords)}
                style={styles.iconPill}
                activeOpacity={0.85}
              >
                <Ionicons name={showPasswords ? 'eye-off-outline' : 'eye-outline'} size={16} color={COLORS.maroon} />
              </TouchableOpacity>
            }
          >
            <View style={styles.passwordCard}>
              <View style={styles.fieldStack}>
                <View style={styles.passwordField}>
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Current Password"
                    placeholderTextColor={COLORS.muted}
                    secureTextEntry={!showPasswords}
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.passwordField}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New Password (min 6 characters)"
                    placeholderTextColor={COLORS.muted}
                    secureTextEntry={!showPasswords}
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.passwordField}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm New Password"
                    placeholderTextColor={COLORS.muted}
                    secureTextEntry={!showPasswords}
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    returnKeyType="done"
                  />
                </View>
              </View>

              {!!passwordMessage && (
                <Text
                  style={[
                    styles.passwordMessage,
                    /success/i.test(passwordMessage) ? { color: COLORS.green } : { color: COLORS.red },
                  ]}
                >
                  {passwordMessage}
                </Text>
              )}

              <TouchableOpacity
                onPress={handleChangePassword}
                style={[styles.passwordBtn, changingPassword && { opacity: 0.7 }]}
                disabled={changingPassword}
                activeOpacity={0.95}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={16} color="#fff" />
                    <Text style={styles.passwordBtnText}>Change Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Section>



          {/* PRIVACY (tourist) */}
          {auth.role === 'tourist' && (
            <Section icon="shield-outline" title="Privacy Settings" subtitle="Control how your name appears in reviews">
              <View style={styles.privacyCard}>
                <View style={styles.privacyHeader}>
                  <View style={styles.privacyIconCircle}>
                    <Ionicons name="eye-off" size={18} color={COLORS.maroon} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privacyHeading}>Anonymous Reviews</Text>
                    <Text style={styles.privacySub}>
                      Choose whether to remain anonymous when giving reviews and ratings.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.privacyToggle, anonymousReviews && styles.privacyToggleActive]}
                    onPress={() => {
                      const newValue = !anonymousReviews;
                      setAnonymousReviews(newValue);
                      updateAnonymousReviewSetting(newValue);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.privacyToggleThumb, anonymousReviews && styles.privacyToggleThumbActive]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.privacyInfo}>
                  <View style={styles.privacyInfoItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.green} />
                    <Text style={styles.privacyInfoText}>When enabled, your name won't be shown in reviews</Text>
                  </View>
                  <View style={styles.privacyInfoItem}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
                    <Text style={styles.privacyInfoText}>You can still change this for individual reviews</Text>
                  </View>
                </View>
              </View>
            </Section>
          )}

          {/* DANGER ZONE */}
          <Section icon="warning-outline" title="Account Deactivation" subtitle="Temporarily disable your account">
            <View style={styles.dangerWrap}>
              <View style={styles.dangerHeaderRow}>
                <View style={styles.dangerIconCircle}>
                  <Ionicons name="warning" size={18} color={COLORS.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerHeading}>Deactivate your account</Text>
                  <Text style={styles.dangerSub}>Your account will be deactivated now.</Text>
                </View>
              </View>

              <View style={styles.dangerList}>
                <View style={styles.dangerListItem}>
                  <Ionicons name="remove-circle-outline" size={16} color={COLORS.red} />
                  <Text style={styles.dangerListText}>Access to your bookings and data will be removed.</Text>
                </View>
                <View style={styles.dangerListItem}>
                  <Ionicons name="time-outline" size={16} color={COLORS.red} />
                  <Text style={styles.dangerListText}>You can cancel deactivation by logging in again within 7 days.</Text>
                </View>
              </View>

              <View style={styles.dangerActionsRow}>
                <TouchableOpacity style={styles.dangerPrimaryBtn} activeOpacity={0.95} onPress={openDeleteModal}>
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.dangerPrimaryText}>Deactivate Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Section>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Deactivate Confirmation Modal */}
      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="warning" size={18} color={COLORS.red} />
                </View>
                <Text style={styles.modalTitle}>Confirm deactivation</Text>
              </View>
              <TouchableOpacity onPress={() => !deleting && setDeleteOpen(false)} disabled={deleting}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Your account will be temporarily deactivated and you'll be logged out immediately.
              </Text>

              <View style={styles.modalInfoBox}>
                <View style={styles.modalInfoItem}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                  <Text style={styles.modalInfoText}>All your data will be safely preserved</Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Ionicons name="time" size={16} color={COLORS.muted} />
                  <Text style={styles.modalInfoText}>Reactivate by logging in within 7 days</Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Ionicons name="trash" size={16} color={COLORS.red} />
                  <Text style={styles.modalInfoText}>Account permanently deleted after 7 days</Text>
                </View>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => setDeleteOpen(false)}
                  disabled={deleting}
                  activeOpacity={0.95}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDanger, deleting && { opacity: 0.6 }]}
                  onPress={confirmDelete}
                  disabled={deleting}
                  activeOpacity={0.95}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnDangerText}>Deactivate Now</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD = {
  radius: 16,
  border: StyleSheet.hairlineWidth,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.wash },
  scrollContainer: { flex: 1 },

  /* HEADER */
  hero: {
    backgroundColor: COLORS.maroon,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },

  /* PROFILE CARD */
  profileCard: {
    marginHorizontal: 16,
    marginTop: -12,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EFE7E4',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.maroon,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  profileEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCD8',
  },

  /* CONTENT */
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },

  /* SECTION */
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: CARD.radius,
    borderWidth: CARD.border,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 12,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    paddingBottom: 8,
    borderBottomWidth: CARD.border,
    borderBottomColor: '#EEF0F4',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDF4F4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: CARD.border,
    borderColor: '#F3DADA',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  sectionSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  iconPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: CARD.border,
    borderColor: COLORS.border,
    backgroundColor: '#FAFAFA',
  },

  /* GRID */
  gridRow: {
    flexDirection: SCREEN_W >= 720 ? 'row' : 'column',
    gap: 10,
  },
  gridCol: {
    flex: 1,
  },

  /* BANNERS */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: CARD.border,
    marginTop: 12,
  },
  bannerSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  bannerText: { fontSize: 13, fontWeight: '700' },

  /* BUTTONS */
  fullBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  fullBtnPrimary: { backgroundColor: COLORS.maroon },
  fullBtnGhost: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.maroon },
  fullBtnTextPrimary: { color: '#fff', fontWeight: '900', letterSpacing: 0.2 },
  fullBtnTextGhost: { color: COLORS.maroon, fontWeight: '900', letterSpacing: 0.2 },

  /* SECURITY */
  passwordCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: CARD.border,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  fieldStack: { gap: 10 },
  passwordField: {
    borderWidth: CARD.border,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#FBFBFB',
  },
  passwordInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  passwordMessage: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  passwordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.maroon,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  passwordBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  /* PROFILE & CONTACT */
  profileContactCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: CARD.border,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 0,
    overflow: 'hidden',
  },
  profileSection: {
    padding: 8,
  },
  profileSectionWithBorder: {
    borderBottomWidth: CARD.border,
    borderBottomColor: '#F1F5F9',
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: CARD.border,
    borderBottomColor: '#F8FAFC',
  },
  profileSectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FDF4F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: CARD.border,
    borderColor: '#F3DADA',
  },
  profileSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.2,
  },



  /* PRIVACY */
  privacyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: CARD.border,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  privacyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  privacyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDF4F4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: CARD.border,
    borderColor: '#F3DADA',
  },
  privacyHeading: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  privacySub: { marginTop: 2, fontSize: 12, color: COLORS.muted },
  privacyToggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', padding: 2, justifyContent: 'center' },
  privacyToggleActive: { backgroundColor: COLORS.maroon },
  privacyToggleThumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  privacyToggleThumbActive: { transform: [{ translateX: 20 }] },
  privacyInfo: { gap: 8, paddingTop: 8, borderTopWidth: CARD.border, borderTopColor: '#EEF0F4' },
  privacyInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  privacyInfoText: { flex: 1, fontSize: 12, color: COLORS.muted },

  /* DANGER */
  dangerWrap: {
    borderRadius: 14,
    borderWidth: CARD.border,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
    padding: 12,
    gap: 10,
  },
  dangerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dangerIconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: CARD.border, borderColor: '#FECACA',
  },
  dangerHeading: { fontSize: 16, fontWeight: '900', color: COLORS.red },
  dangerSub: { marginTop: 2, fontSize: 12, color: '#7F1D1D' },
  dangerList: { gap: 6 },
  dangerListItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerListText: { flex: 1, fontSize: 13, color: '#7F1D1D' },
  dangerActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end' },
  dangerPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.red,
  },
  dangerPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
    borderWidth: CARD.border,
    borderColor: COLORS.border,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: CARD.border,
    borderBottomColor: '#EEF0F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: CARD.border,
    borderColor: '#FECACA',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  modalBody: { padding: 16 },
  modalText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  modalInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  modalInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: '#FFFFFF', borderWidth: CARD.border, borderColor: COLORS.border },
  modalBtnDanger: { backgroundColor: COLORS.red },
  modalBtnGhostText: { color: COLORS.text, fontWeight: '900' },
  modalBtnDangerText: { color: '#FFFFFF', fontWeight: '900' },


  /* LOADING */
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', backgroundColor: COLORS.maroon, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
import React, { useEffect, useRef, useState } from 'react';
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
} from '../../services/authService';
import {
  getGoodsServicesProfileByAuthor,
  upsertGoodsServicesProfile,
  deleteGoodsServicesPost,
  uploadGoodsServicesMedia,
} from '../../services/goodsServices';
import MobilePhotoUpload from '../../services/MobilePhotoUpload';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import AccountDeletionHandler from '../../components/AccountDeletionHandler';

const COLORS = {
  maroon: '#6B2E2B',
  text: '#0F172A',
  muted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F8FAFC',
  white: '#FFFFFF',
  green: '#14532D',
  red: '#B91C1C',
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

  const [bioDescription, setBioDescription] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [bioMessage, setBioMessage] = useState('');
  const [bioPhotos, setBioPhotos] = useState([]); // array of { uri }
  const [existingBioId, setExistingBioId] = useState(null);

  // Danger Zone modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
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
            setPhotoUrl(
              userData.profile_photo ||
                userData.profile_photo_url ||
                userData.avatar_url ||
                ''
            );
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
              setPhotoUrl(data.user.user_metadata?.profile_photo_url || '');
            }
          }

          if (authorIdForBio) {
            try {
              const profileResult = await getGoodsServicesProfileByAuthor(
                authorIdForBio
              );
              if (profileResult.success && profileResult.data) {
                if (profileResult.data.description)
                  setBioDescription(profileResult.data.description);
                if (profileResult.data.id)
                  setExistingBioId(profileResult.data.id);
              }
            } catch {}
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setError('Failed to load user data');
        }
      };
      fetchUser();
    }
  }, [auth.loading, auth.isAuthenticated]);

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

  const avatarName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const avatarUrl =
    photoUrl
      ? photoUrl
      : avatarName
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
          avatarName
        )}&background=6B2E2B&color=fff&size=128`
      : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128';

  // Small helpers
  const FullWidthButton = ({ title, onPress, tone = 'primary', loading }) => {
    const isPrimary = tone === 'primary';
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.9}
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
  };

  const Banner = ({ type = 'success', children }) => {
    const isError = type === 'error';
    return (
      <View style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}>
        <Ionicons
          name={isError ? 'alert-circle' : 'checkmark-circle'}
          size={16}
          color={isError ? COLORS.red : COLORS.green}
          style={{ marginRight: 8 }}
        />
        <Text
          style={[
            styles.bannerText,
            { color: isError ? COLORS.red : COLORS.green },
          ]}
        >
          {children}
        </Text>
      </View>
    );
  };

  const Section = ({ icon, title, children, right }) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={icon} size={18} color={COLORS.maroon} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );

  const handlePickImage = async () => {
    try {
      const photoService = new MobilePhotoUpload();
      const image = await photoService.pickImage();
      if (!image) return;
      await uploadImage(image.uri);
    } catch (error) {
      console.error('Image picker error:', error);
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
        const result = await photoService.uploadProfilePhoto(
          currentUser.id,
          uri
        );
        if (result.success) {
          setPhotoUrl(result.photo_url);
          // Update the user profile with the new photo URL
          await updateUserProfile(currentUser.id, { profile_photo: result.photo_url });
          setSuccess('Profile photo updated!');
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

        const { data: publicUrlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(uploadPath);
        if (!publicUrlData?.publicUrl)
          throw new Error('Failed to get public URL');

        setPhotoUrl(publicUrlData.publicUrl);
        await supabase.auth.updateUser({
          data: { profile_photo_url: publicUrlData.publicUrl },
        });
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

  // Web: file input change
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
            const result = await uploadProfilePhoto(
              currentUser.id,
              e.target.result
            );
            if (result.success) {
              setPhotoUrl(result.photoUrl);
              // Update the user profile with the new photo URL
              await updateUserProfile(currentUser.id, { profile_photo: result.photoUrl });
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

        const { data: publicUrlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(uploadPath);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');

        setPhotoUrl(publicUrlData.publicUrl);
        await supabase.auth.updateUser({
          data: { profile_photo_url: publicUrlData.publicUrl },
        });
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
        const fullName = [firstName, middleName, lastName]
          .filter(Boolean)
          .join(' ');
        const profileData = {
          name: fullName,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email,
          phone,
          profile_photo: photoUrl,
        };
        Object.keys(profileData).forEach((k) => {
          if (
            profileData[k] === '' ||
            profileData[k] === null ||
            profileData[k] === undefined
          ) {
            delete profileData[k];
          }
        });
        const result = await updateUserProfile(currentUser.id, profileData);
        if (result.success) {
          setSuccess(result.message || 'Account updated successfully!');
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
          setError(
            metaError?.message ||
              emailError?.message ||
              'Failed to update account.'
          );
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

  const handleSaveBio = async () => {
    try {
      setSavingBio(true);
      setBioMessage('');

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setBioMessage('You must be logged in.');
        return;
      }
      const role = (currentUser.role || '').toLowerCase();
      if (!['driver', 'owner'].includes(role)) {
        setBioMessage('Only drivers and owners can update bio.');
        return;
      }

      if (!bioDescription.trim()) {
        if (existingBioId) {
          try {
            const del = await deleteGoodsServicesPost(
              existingBioId,
              currentUser.id
            );
            if (!del.success) {
              setBioMessage(del.error || 'Failed to clear bio');
              return;
            }
            setExistingBioId(null);
          } catch (err) {
            setBioMessage(err.message || 'Failed to clear bio');
            return;
          }
        }
        setBioDescription('');
        setBioPhotos([]);
        setBioMessage('Bio cleared.');
        return;
      }

      let media = [];
      if (bioPhotos.length > 0) {
        try {
          const uploadRes = await uploadGoodsServicesMedia(
            currentUser.id,
            bioPhotos
          );
          if (!uploadRes.success) {
            setBioMessage(uploadRes.error || 'Failed to upload photos');
            return;
          }
          media = uploadRes.urls
            ? uploadRes.urls.map((url) => ({ url, type: 'image' }))
            : [];
        } catch {
          setBioMessage('Failed to upload photos. Please try again.');
          return;
        }
      }

      const result = await upsertGoodsServicesProfile(
        currentUser.id,
        bioDescription.trim(),
        media
      );
      if (result.success) {
        setBioMessage('Bio saved.');
        if (media.length > 0) setBioPhotos([]);
        const returned = result.data?.data || result.data;
        if (
          returned &&
          (returned.id || (Array.isArray(returned) && returned[0]?.id))
        ) {
          const id = returned.id || returned[0]?.id;
          setExistingBioId(id);
        }
        setTimeout(async () => {
          try {
            const refreshResult = await getGoodsServicesProfileByAuthor(
              currentUser.id
            );
            if (refreshResult.success && refreshResult.data) {
              setBioDescription(refreshResult.data.description || '');
              if (refreshResult.data.id) setExistingBioId(refreshResult.data.id);
            }
          } catch {}
        }, 800);
      } else {
        setBioMessage(result.error || 'Failed to save bio');
      }
    } catch (e) {
      setBioMessage(e.message || 'Failed to save bio');
    } finally {
      setSavingBio(false);
    }
  };

  const handleBioMenu = async () => {
    try {
      Alert.alert('Bio options', '', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: existingBioId ? 'Update' : 'Add',
          onPress: () => handleSaveBio(),
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = await getCurrentUser();
              if (!currentUser) {
                setBioMessage('You must be logged in.');
                return;
              }
              if (existingBioId) {
                const del = await deleteGoodsServicesPost(
                  existingBioId,
                  currentUser.id
                );
                if (!del.success) {
                  setBioMessage(del.error || 'Failed to clear bio');
                  return;
                }
              }
              setBioDescription('');
              setBioPhotos([]);
              setExistingBioId(null);
              setBioMessage('Bio cleared.');
            } catch (err) {
              setBioMessage(err.message || 'Failed to clear bio');
            }
          },
        },
      ]);
    } catch {
      setBioMessage('Unable to open menu');
    }
  };

  const openDeleteModal = () => {
    setDeleteConfirmText('');
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const currentUser = await getCurrentUser();
      if (currentUser) {
        AccountDeletionHandler.requestDeletion(
          currentUser.id,
          'User requested account deletion',
          () => auth.logout()
        );
        setDeleteOpen(false);
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to schedule deletion.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteEnabled = deleteConfirmText.trim().toUpperCase() === 'DELETE';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Profile Card */}
        <View style={styles.headerCard}>
          <View style={{ alignItems: 'center' }}>
            {Platform.OS === 'web' ? (
              <>
                <img
                  src={avatarUrl}
                  alt="Profile"
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    border: `3px solid ${COLORS.maroon}`,
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
                <TouchableOpacity
                  onPress={() => fileInputRef.current?.click()}
                  style={styles.changePhotoBtn}
                  disabled={uploading}
                >
                  <Ionicons name="camera" size={16} color={COLORS.maroon} />
                  <Text style={styles.changePhotoText}>Change photo</Text>
                </TouchableOpacity>
                {uploading ? (
                  <ActivityIndicator size="small" color={COLORS.maroon} />
                ) : null}
              </>
            ) : (
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploading}
                activeOpacity={0.9}
              >
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <View style={styles.changePhotoBtn}>
                  <Ionicons name="camera" size={16} color={COLORS.maroon} />
                  <Text style={styles.changePhotoText}>Change photo</Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.title}>
              {avatarName || 'Account Details'}
            </Text>
            <Text style={styles.subtitle}>
              Manage your profile and public info
            </Text>
          </View>
        </View>

        {/* Feedback */}
        {!!error && <Banner type="error">{error}</Banner>}
        {!!success && <Banner type="success">{success}</Banner>}

        {/* Profile Details */}
        <Section icon="person-circle-outline" title="Profile">
          <View style={styles.fieldStack}>
            <EditableField
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
            />
            <EditableField
              value={middleName}
              onChangeText={setMiddleName}
              placeholder="Middle Name"
            />
            <EditableField
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
            />
          </View>
        </Section>

        {/* Contact */}
        <Section icon="mail-outline" title="Contact">
          <View style={styles.fieldStack}>
            <EditableField
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
            />
            <EditableField
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
            />
          </View>
        </Section>

        {/* Save CTA */}
        <FullWidthButton
          title={loading ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          loading={loading}
        />

        {/* Bio (Drivers / Owners) — redesigned */}
        {['driver', 'owner'].includes((auth.role || '').toLowerCase()) && (
          <Section
            icon="briefcase-outline"
            title="Goods & Services Bio"
            right={
              <TouchableOpacity
                onPress={handleBioMenu}
                style={styles.iconPill}
                activeOpacity={0.85}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.maroon} />
              </TouchableOpacity>
            }
          >
            <View style={styles.gsCard}>
              {/* Label + character counter */}
              <View style={styles.gsLabelRow}>
                <Text style={styles.gsLabel}>Short description</Text>
                <Text
                  style={[
                    styles.gsChar,
                    (bioDescription?.length || 0) > 480 && { color: COLORS.red },
                  ]}
                >
                  {(bioDescription?.length || 0)}/500
                </Text>
              </View>

              {/* Description input */}
              <TextInput
                style={styles.gsInput}
                value={bioDescription}
                onChangeText={(t) => {
                  if (t.length <= 500) setBioDescription(t);
                }}
                placeholder="Tell customers what you offer, your area, rates, and availability…"
                placeholderTextColor={COLORS.muted}
                multiline
              />

              <Text style={styles.gsHelp}>
                Tip: Keep it specific (services, locations, hours). You can add up to 5 photos.
              </Text>

              {/* Controls row */}
              <View style={styles.gsControls}>
                <TouchableOpacity
                  style={styles.gsAddBtn}
                  onPress={async () => {
                    try {
                      const capacity = Math.max(0, 5 - bioPhotos.length);
                      if (capacity <= 0) return;
                      const uploader = new MobilePhotoUpload();
                      const images = await uploader.pickMultipleImages(capacity);
                      if (images && images.length > 0) {
                        setBioPhotos((prev) => [...prev, ...images]);
                      }
                    } catch {
                      setBioMessage('Failed to select images. Please try again.');
                    }
                  }}
                  disabled={bioPhotos.length >= 5 || savingBio}
                  activeOpacity={0.9}
                >
                  <Ionicons name="images-outline" size={16} color={COLORS.maroon} />
                  <Text style={styles.gsAddText}>Add photos</Text>
                  <Text style={styles.gsAddCount}>({bioPhotos.length}/5)</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  onPress={handleSaveBio}
                  activeOpacity={0.9}
                  style={[styles.gsSaveBtn, savingBio && { opacity: 0.7 }]}
                  disabled={savingBio}
                >
                  {savingBio ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={16} color="#fff" />
                      <Text style={styles.gsSaveText}>
                        {existingBioId ? 'Update Bio' : 'Save Bio'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Photo grid */}
              <View style={styles.gsGrid}>
                {bioPhotos.map((photo, i) => (
                  <View key={i} style={styles.gsTile}>
                    <Image source={{ uri: photo.uri }} style={styles.gsThumb} />
                    <TouchableOpacity
                      style={styles.gsRemove}
                      onPress={() =>
                        setBioPhotos((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      activeOpacity={0.9}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}

                {bioPhotos.length < 5 && (
                  <TouchableOpacity
                    style={styles.gsAddTile}
                    onPress={async () => {
                      try {
                        const capacity = Math.max(0, 5 - bioPhotos.length);
                        if (capacity <= 0) return;
                        const uploader = new MobilePhotoUpload();
                        const images = await uploader.pickMultipleImages(capacity);
                        if (images && images.length > 0) {
                          setBioPhotos((prev) => [...prev, ...images]);
                        }
                      } catch {
                        setBioMessage('Failed to select images. Please try again.');
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="add" size={22} color={COLORS.maroon} />
                    <Text style={styles.gsAddTileText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!bioMessage && (
                <Text
                  style={[
                    styles.gsNote,
                    /saved|cleared/i.test(bioMessage)
                      ? { color: COLORS.green }
                      : { color: COLORS.red },
                  ]}
                >
                  {bioMessage}
                </Text>
              )}
            </View>
          </Section>
        )}

        {/* Danger Zone — Redesigned */}
        <Section icon="warning-outline" title="Danger Zone">
          <View style={styles.dangerWrap}>
            <View style={styles.dangerHeaderRow}>
              <View style={styles.dangerIconCircle}>
                <Ionicons name="warning" size={18} color={COLORS.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dangerHeading}>Delete your account</Text>
                <Text style={styles.dangerSub}>
                  This is permanent. Your account will be scheduled for deletion in 7 days.
                </Text>
              </View>
            </View>

            <View style={styles.dangerList}>
              <View style={styles.dangerListItem}>
                <Ionicons name="remove-circle-outline" size={16} color={COLORS.red} />
                <Text style={styles.dangerListText}>Access to your bookings and data will be removed.</Text>
              </View>
              <View style={styles.dangerListItem}>
                <Ionicons name="time-outline" size={16} color={COLORS.red} />
                <Text style={styles.dangerListText}>You can cancel deletion by logging in again within 7 days.</Text>
              </View>
            </View>

            <View style={styles.dangerActionsRow}>
              <TouchableOpacity
                style={styles.dangerGhostBtn}
                activeOpacity={0.9}
                onPress={() => Alert.alert('Need help?', 'Contact support at support@example.com')}
              >
                <Ionicons name="help-circle-outline" size={16} color={COLORS.red} />
                <Text style={styles.dangerGhostText}>Need help</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dangerPrimaryBtn}
                activeOpacity={0.9}
                onPress={openDeleteModal}
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.dangerPrimaryText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
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
                <Text style={styles.modalTitle}>Confirm deletion</Text>
              </View>
              <TouchableOpacity
                onPress={() => !deleting && setDeleteOpen(false)}
                disabled={deleting}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                Deleting your account will schedule it for removal in 7 days. To confirm,
                type <Text style={{ fontWeight: '800', color: COLORS.text }}>DELETE</Text> below.
              </Text>

              <TextInput
                style={styles.confirmInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="Type DELETE to confirm"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                editable={!deleting}
              />

              <View style={styles.modalList}>
                <View style={styles.modalListItem}>
                  <Ionicons name="ban-outline" size={16} color={COLORS.red} />
                  <Text style={styles.modalListText}>This action cannot be undone after 7 days.</Text>
                </View>
                <View style={styles.modalListItem}>
                  <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
                  <Text style={styles.modalListText}>You’ll be logged out immediately.</Text>
                </View>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => setDeleteOpen(false)}
                  disabled={deleting}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    styles.modalBtnDanger,
                    (!deleteEnabled || deleting) && { opacity: 0.6 },
                  ]}
                  onPress={confirmDelete}
                  disabled={!deleteEnabled || deleting}
                  activeOpacity={0.9}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnDangerText}>Confirm Delete</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.confirmHint}>
                Tip: You can restore access by logging in again within 7 days.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.maroon, fontSize: 16, fontWeight: '600' },

  // Header card
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 100,
    marginBottom: 12,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: COLORS.maroon,
  },
  uploadingOverlay: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 64,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FDF4F4',
    borderWidth: 1,
    borderColor: '#F3DADA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  changePhotoText: {
    color: COLORS.maroon,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },

  // Reusable section card
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 12,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  iconPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FAFAFA',
  },

  // Fields
  fieldStack: { gap: 10 },

  // Banners
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
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
  bannerText: { fontSize: 13, fontWeight: '600' },

  // Primary / Ghost CTAs
  fullBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  fullBtnPrimary: {
    backgroundColor: COLORS.maroon,
  },
  fullBtnGhost: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.maroon,
  },
  fullBtnTextPrimary: { color: '#fff', fontWeight: '800' },
  fullBtnTextGhost: { color: COLORS.maroon, fontWeight: '800' },

  // (Old Bio styles kept intact in case of reuse elsewhere)
  bioInput: {
    minHeight: 100,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    color: COLORS.text,
    backgroundColor: '#FBFBFB',
  },
  bioToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FDF4F4',
    borderWidth: 1,
    borderColor: '#F3DADA',
  },
  addPhotoText: { color: COLORS.maroon, fontWeight: '700', fontSize: 12 },
  photoStrip: { marginTop: 10 },
  photoItem: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoThumb: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioNote: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },

  // ===== Redesigned Danger Zone =====
  dangerWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
    padding: 14,
    gap: 12,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dangerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.red,
  },
  dangerSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#7F1D1D',
  },
  dangerList: {
    gap: 6,
  },
  dangerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerListText: {
    flex: 1,
    fontSize: 13,
    color: '#7F1D1D',
  },
  dangerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  dangerGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
  },
  dangerGhostText: {
    color: COLORS.red,
    fontWeight: '800',
    fontSize: 12,
  },
  dangerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.red,
  },
  dangerPrimaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  // ===== Modal Styles =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalBody: {
    padding: 16,
  },
  modalText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  confirmInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#FAFAFA',
  },
  modalList: {
    marginTop: 12,
    gap: 8,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalListText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnDanger: {
    backgroundColor: COLORS.red,
  },
  modalBtnGhostText: {
    color: COLORS.text,
    fontWeight: '800',
  },
  modalBtnDangerText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  confirmHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  // ===== Goods & Services Bio (redesign) =====
  gsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  gsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gsChar: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  gsInput: {
    minHeight: 110,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    color: COLORS.text,
    backgroundColor: '#FBFBFB',
    lineHeight: 20,
  },
  gsHelp: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  gsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  gsAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FDF4F4',
    borderWidth: 1,
    borderColor: '#F3DADA',
  },
  gsAddText: { color: COLORS.maroon, fontWeight: '800', fontSize: 12 },
  gsAddCount: { color: COLORS.maroon, fontWeight: '700', fontSize: 12, opacity: 0.9 },
  gsSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.maroon,
  },
  gsSaveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  gsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  gsTile: {
    width: 86,
    height: 86,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  gsThumb: { width: '100%', height: '100%' },
  gsRemove: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gsAddTile: {
    width: 86,
    height: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3DADA',
    backgroundColor: '#FFF7F7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gsAddTileText: { color: COLORS.maroon, fontWeight: '800', fontSize: 12 },
  gsNote: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
});

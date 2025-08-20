import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking, TextInput, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import EditableField from '../../components/EditableField';
import Button from '../../components/Button';
import BackButton from '../../components/BackButton';
import { getCurrentUser, getUserProfile, updateUserProfile, uploadProfilePhoto } from '../../services/authService';
import { getGoodsServicesProfileByAuthor, upsertGoodsServicesProfile, deleteGoodsServicesPost } from '../../services/goodsServices';
import MobilePhotoUpload from '../../services/MobilePhotoUpload';
import { uploadGoodsServicesMedia } from '../../services/goodsServices';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function AccountDetailsScreen({ navigation }) {
  // All hooks must be called at the top level, before any conditional returns
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

  // Handle authentication redirect in useEffect to avoid hooks rule violation
  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

  // Fetch user data - this hook must be called unconditionally
  useEffect(() => {
    // Only fetch if authenticated and not loading
    if (!auth.loading && auth.isAuthenticated) {
      const fetchUser = async () => {
        try {
          let authorIdForBio = null;
          // Get current user from stored session
          const currentUser = await getCurrentUser();
          if (currentUser) {
            // Try to get detailed profile from API
            const profileResult = await getUserProfile(currentUser.id);
            
            let userData = currentUser;
            if (profileResult.success && profileResult.data) {
              userData = { ...currentUser, ...profileResult.data };
            }
            
            authorIdForBio = currentUser.id;
            // Parse name if available - handle both API formats
            const fullName = userData.name || userData.full_name || '';
            const nameParts = fullName.split(' ');
            setFirstName(userData.first_name || nameParts[0] || '');
            setMiddleName(userData.middle_name || nameParts[1] || '');
            setLastName(userData.last_name || nameParts[2] || '');
            setEmail(userData.email || '');
            setPhone(userData.phone || '');
            setPhotoUrl(userData.profile_photo || userData.profile_photo_url || userData.avatar_url || '');
          } else {
            // Fallback to Supabase if no session found (for compatibility)
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
          // Prefill bio (goods/services profile) if exists
          if (authorIdForBio) {
            try {
              const profileResult = await getGoodsServicesProfileByAuthor(authorIdForBio);
              if (profileResult.success && profileResult.data) {
                if (profileResult.data.description) setBioDescription(profileResult.data.description);
                if (profileResult.data.id) setExistingBioId(profileResult.data.id);
              }
            } catch (e) {
              // Non-blocking
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setError('Failed to load user data');
        }
      };
      fetchUser();
    }
  }, [auth.loading, auth.isAuthenticated]);

  // Show loading while auth is being determined
  if (auth.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Return null while redirecting (but after all hooks have been called)
  if (!auth.isAuthenticated) {
    return null;
  }

  const avatarName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const avatarUrl = photoUrl
    ? photoUrl
    : avatarName
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=6B2E2B&color=fff&size=128`
    : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128';

  const handlePickImage = async () => {
    try {
      const photoService = new MobilePhotoUpload();
      
      // Pick image using the service
      const image = await photoService.pickImage();
      if (!image) return; // User cancelled or error occurred
      
      console.log('Selected image:', image);
      
      // Upload the selected image
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
      
      console.log('Starting photo upload for URI:', uri);
      
      // Check if user is logged in via new auth system
      const currentUser = await getCurrentUser();
      console.log('Current user:', currentUser);
      
      if (currentUser) {
        // Use MobilePhotoUpload service
        console.log('Using MobilePhotoUpload service for photo upload');
        const photoService = new MobilePhotoUpload();
        const result = await photoService.uploadProfilePhoto(currentUser.id, uri);
        console.log('Upload result:', result);
        
        if (result.success) {
          console.log('Photo uploaded successfully, URL:', result.photo_url);
          
          // Update local state immediately
          setPhotoUrl(result.photo_url);
          
          // Try to update the user profile with the new photo URL
          try {
            const profileUpdateData = {
              profile_photo_url: result.photo_url
            };
            
            console.log('Updating profile with photo URL:', profileUpdateData);
            const updateResult = await updateUserProfile(currentUser.id, profileUpdateData);
            console.log('Profile update result:', updateResult);
            
            if (updateResult.success) {
              setSuccess('Profile photo updated successfully!');
              console.log('Profile updated successfully with photo URL');
            } else {
              // Photo upload succeeded but profile update failed
              console.warn('Photo uploaded but profile update failed:', updateResult.error);
              setSuccess('Photo uploaded successfully!');
            }
          } catch (profileError) {
            console.error('Profile update error:', profileError);
            // Still show success since the photo was uploaded
            setSuccess('Photo uploaded successfully!');
          }
        } else {
          console.error('Photo upload failed:', result.error);
          throw new Error(result.error || 'Failed to upload photo');
        }
      } else {
        console.log('Using Supabase fallback for photo upload');
        // Fallback to Supabase for existing users
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileExt = uri.split('.').pop();
        const fileName = `profile_${Date.now()}.${fileExt}`;
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        
        if (!userId) {
          throw new Error('User not found');
        }
        
        const uploadPath = `${userId}/${fileName}`;
        const { data, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(uploadPath, blob, { upsert: true });
          
        console.log('Supabase upload response:', data, uploadError);
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: publicUrlData, error: publicUrlError } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(uploadPath);
          
        console.log('Supabase public URL response:', publicUrlData, publicUrlError);
        if (!publicUrlData?.publicUrl) {
          throw new Error('Failed to get public URL');
        }
        
        setPhotoUrl(publicUrlData.publicUrl);
        
        // Save to user_metadata
        await supabase.auth.updateUser({ 
          data: { profile_photo_url: publicUrlData.publicUrl } 
        });
        
        setSuccess('Profile photo updated successfully!');
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err.message || 'Failed to upload photo.';
      setError(errorMessage);
      
      // Show user-friendly error message
      Alert.alert(
        'Upload Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
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
        setBioMessage('Please enter a bio description.');
        return;
      }

      // If there are selected photos, upload them first
      let media = [];
      if (bioPhotos.length > 0) {
        const uploadRes = await uploadGoodsServicesMedia(currentUser.id, bioPhotos);
        if (!uploadRes.success) {
          setBioMessage(uploadRes.error || 'Failed to upload media');
          return;
        }
        media = uploadRes.urls.map((url) => ({ url, type: 'image' }));
      }

      const result = await upsertGoodsServicesProfile(currentUser.id, bioDescription.trim(), media);
      if (result.success) {
        setBioMessage('Bio saved!');
        if (media.length > 0) setBioPhotos([]);
        // If backend returned id, store it; otherwise keep previous
        const returned = result.data?.data || result.data;
        if (returned && (returned.id || (Array.isArray(returned) && returned[0]?.id))) {
          const id = returned.id || returned[0]?.id;
          setExistingBioId(id);
        }
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
      Alert.alert(
        'Bio options',
        '',
        [
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
                  const del = await deleteGoodsServicesPost(existingBioId, currentUser.id);
                  if (!del.success) {
                    setBioMessage(del.error || 'Failed to clear bio');
                    return;
                  }
                }
                setBioDescription('');
                setBioPhotos([]);
                setExistingBioId(null);
                setBioMessage('Bio cleared!');
              } catch (err) {
                setBioMessage(err.message || 'Failed to clear bio');
              }
            }
          }
        ]
      );
    } catch (e) {
      // fallback
      setBioMessage('Unable to open menu');
    }
  };

  // Web: handle file input change
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setUploading(true);
      setError('');
      
      // Check if user is logged in via new auth system
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        // Convert file to data URI for upload
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const result = await uploadProfilePhoto(currentUser.id, e.target.result);
            
            if (result.success) {
              setPhotoUrl(result.photoUrl);
              setSuccess('Profile photo updated!');
            } else {
              throw new Error(result.error || 'Failed to upload photo');
            }
          } catch (err) {
            setError(err.message || 'Failed to upload photo.');
            console.error('Web Upload error:', err);
          } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        reader.readAsDataURL(file);
        return; // Early return to avoid the finally block
      } else {
        // Fallback to Supabase for existing users
        const fileExt = file.name.split('.').pop();
        const fileName = `profile_${Date.now()}.${fileExt}`;
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) throw new Error('User not found');
        const uploadPath = `${userId}/${fileName}`;
        const { data, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(uploadPath, file, { upsert: true });
        console.log('Web Upload response:', data, uploadError);
        if (uploadError) throw uploadError;
        // Get public URL
        const { data: publicUrlData, error: publicUrlError } = supabase.storage.from('profile-photos').getPublicUrl(uploadPath);
        console.log('Web Public URL response:', publicUrlData, publicUrlError);
        if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');
        setPhotoUrl(publicUrlData.publicUrl);
        // Save to user_metadata
        await supabase.auth.updateUser({ data: { profile_photo_url: publicUrlData.publicUrl } });
        setSuccess('Profile photo updated!');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload photo.');
      console.error('Web Upload error:', err);
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
      // Check if user is logged in via new auth system
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        // Use new profile update API
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
        const profileData = {
          name: fullName,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email: email,
          phone: phone,
          profile_photo: photoUrl,
        };
        
        // Remove empty values
        Object.keys(profileData).forEach(key => {
          if (profileData[key] === '' || profileData[key] === null || profileData[key] === undefined) {
            delete profileData[key];
          }
        });
        
        const result = await updateUserProfile(currentUser.id, profileData);
        
        if (result.success) {
          setSuccess(result.message || 'Account details updated successfully!');
          
          // Note: Session will be updated on next app restart or when user logs in again
          // For now, we'll just show success message
        } else {
          setError(result.error || 'Failed to update profile.');
        }
      } else {
        // Fallback to Supabase for existing users
        const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
        const updates = {
          data: { name, phone, profile_photo_url: photoUrl },
        };
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
          setSuccess('Account details updated!');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Failed to save changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Account Details</Text>
      <View style={styles.avatarContainer}>
        {Platform.OS === 'web' ? (
          <>
            <img
              src={avatarUrl}
              alt="Profile"
              style={{ width: 96, height: 96, borderRadius: 48, border: '2px solid #6B2E2B', marginBottom: 8, objectFit: 'cover' }}
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ marginBottom: 8 }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploading && <ActivityIndicator size="small" color="#6B2E2B" />}
            <Text style={styles.changePhotoText}>Choose a photo</Text>
          </>
        ) : (
          <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            <Text style={styles.changePhotoText}>Tap to change photo</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentInsetAdjustmentBehavior="always"
      >
        <EditableField value={firstName} onChangeText={setFirstName} placeholder="First Name" />
        <EditableField value={middleName} onChangeText={setMiddleName} placeholder="Middle Name" />
        <EditableField value={lastName} onChangeText={setLastName} placeholder="Last Name" />
        <EditableField value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
        <EditableField value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        <Button title={loading ? 'Saving...' : 'Save Changes'} onPress={handleSave} />

        {/* Bio for Drivers/Owners */}
        {['driver', 'owner'].includes((auth.role || '').toLowerCase()) && (
          <View style={styles.postContainer}>
            <Text style={styles.postTitle}>Your Bio (Goods & Services)</Text>
            {/* Combined composer like Facebook */}
            <View style={styles.bioComposer}>
              <TextInput
                style={styles.bioInput}
                value={bioDescription}
                onChangeText={setBioDescription}
                placeholder="Describe your goods/services..."
                placeholderTextColor="#888"
                multiline
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
              />
              <View style={styles.bioToolbar}>
                {/* Add photos button */}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={async () => {
                    try {
                      const uploader = new MobilePhotoUpload();
                      const images = await uploader.pickMultipleImages(5);
                      if (images && images.length > 0) {
                        setBioPhotos((prev) => [...prev, ...images]);
                        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                      }
                    } catch (e) {}
                  }}
                >
                  <Ionicons name="add-circle-outline" size={22} color="#6B2E2B" />
                </TouchableOpacity>
                {/* 3-dots menu */}
                <TouchableOpacity style={styles.iconButton} onPress={handleBioMenu}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="#6B2E2B" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <Button title={savingBio ? 'Saving...' : (existingBioId ? 'Update' : 'Add')} onPress={handleSaveBio} />
              </View>
              {bioPhotos.length > 0 ? (
                <Text style={{ color: '#555', marginTop: 6 }}>{bioPhotos.length} photo(s) selected</Text>
              ) : null}
            </View>
            {bioMessage ? <Text style={bioMessage.includes('!') ? styles.success : styles.error}>{bioMessage}</Text> : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', paddingTop: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#6B2E2B', marginTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', alignSelf: 'center', marginTop: 48, marginBottom: 16, color: '#222' },
  avatarContainer: { alignItems: 'center', marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#6B2E2B', marginBottom: 8 },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, width: 96, height: 96, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { color: '#6B2E2B', fontSize: 12, marginBottom: 8 },
  form: { paddingHorizontal: 18, paddingBottom: 32 },
  error: { color: 'red', marginBottom: 8, textAlign: 'center' },
  success: { color: 'green', marginBottom: 8, textAlign: 'center' },
  postContainer: { marginTop: 24 },
  postTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  bioComposer: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#bbb', padding: 10 },
  bioInput: { minHeight: 80, maxHeight: 200, textAlignVertical: 'top', color: '#222', fontSize: 16 },
  bioToolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  iconButton: { paddingHorizontal: 8, paddingVertical: 6 },
});

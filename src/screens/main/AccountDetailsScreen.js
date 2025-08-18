import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import EditableField from '../../components/EditableField';
import Button from '../../components/Button';
import BackButton from '../../components/BackButton';
import { getCurrentUser, getUserProfile, updateUserProfile, uploadProfilePhoto } from '../../services/authService';
import MobilePhotoUpload from '../../services/MobilePhotoUpload';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function AccountDetailsScreen({ navigation }) {
  // All hooks must be called at the top level, before any conditional returns
  const auth = useAuth();
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
          // Get current user from stored session
          const currentUser = await getCurrentUser();
          if (currentUser) {
            // Try to get detailed profile from API
            const profileResult = await getUserProfile(currentUser.id);
            
            let userData = currentUser;
            if (profileResult.success && profileResult.data) {
              userData = { ...currentUser, ...profileResult.data };
            }
            
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
    <View style={styles.container}>
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
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <EditableField value={firstName} onChangeText={setFirstName} placeholder="First Name" />
        <EditableField value={middleName} onChangeText={setMiddleName} placeholder="Middle Name" />
        <EditableField value={lastName} onChangeText={setLastName} placeholder="Last Name" />
        <EditableField value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
        <EditableField value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        <Button title={loading ? 'Saving...' : 'Save Changes'} onPress={handleSave} />
      </ScrollView>
    </View>
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
});

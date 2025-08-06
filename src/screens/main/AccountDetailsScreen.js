import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import EditableField from '../../components/EditableField';
import Button from '../../components/Button';
import BackButton from '../../components/BackButton';
import { supabase } from '../../services/supabase';

export default function AccountDetailsScreen({ navigation }) {
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

  const avatarName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const avatarUrl = photoUrl
    ? photoUrl
    : avatarName
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=6B2E2B&color=fff&size=128`
    : 'https://ui-avatars.com/api/?name=User&background=6B2E2B&color=fff&size=128';

  useEffect(() => {
    const fetchUser = async () => {
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
    };
    fetchUser();
  }, []);

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Photo upload is only supported on mobile devices.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access media library is required!');
      return;
    }
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.IMAGE,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (pickerResult.canceled) {
        Alert.alert('Cancelled', 'Image selection was cancelled.');
        return;
      }
      if (pickerResult.assets && pickerResult.assets.length > 0) {
        uploadImage(pickerResult.assets[0].uri);
      } else {
        Alert.alert('Error', 'No image selected.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open image picker.');
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploading(true);
      setError('');
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop();
      const fileName = `profile_${Date.now()}.${fileExt}`;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('User not found');
      const uploadPath = `${userId}/${fileName}`;
      const { data, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(uploadPath, blob, { upsert: true });
      console.log('Upload response:', data, uploadError);
      if (uploadError) throw uploadError;
      // Get public URL
      const { data: publicUrlData, error: publicUrlError } = supabase.storage.from('profile-photos').getPublicUrl(uploadPath);
      console.log('Public URL response:', publicUrlData, publicUrlError);
      if (!publicUrlData?.publicUrl) throw new Error('Failed to get public URL');
      setPhotoUrl(publicUrlData.publicUrl);
      // Save to user_metadata
      await supabase.auth.updateUser({ data: { profile_photo_url: publicUrlData.publicUrl } });
      setSuccess('Profile photo updated!');
    } catch (err) {
      setError(err.message || 'Failed to upload photo.');
      console.error('Upload error:', err);
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
    const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
    // Update user_metadata (name, phone, photo) and email
    const updates = {
      data: { name, phone, profile_photo_url: photoUrl },
    };
    const { error: metaError } = await supabase.auth.updateUser(updates);
    let emailError = null;
    if (email) {
      // Only update email if changed
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email !== email) {
        const { error: eError } = await supabase.auth.updateUser({ email });
        emailError = eError;
      }
    }
    setLoading(false);
    if (metaError || emailError) {
      setError(metaError?.message || emailError?.message || 'Failed to update account.');
    } else {
      setSuccess('Account details updated!');
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
  title: { fontSize: 24, fontWeight: 'bold', alignSelf: 'center', marginTop: 48, marginBottom: 16, color: '#222' },
  avatarContainer: { alignItems: 'center', marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#6B2E2B', marginBottom: 8 },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, width: 96, height: 96, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { color: '#6B2E2B', fontSize: 12, marginBottom: 8 },
  form: { paddingHorizontal: 18, paddingBottom: 32 },
  error: { color: 'red', marginBottom: 8, textAlign: 'center' },
  success: { color: 'green', marginBottom: 8, textAlign: 'center' },
});

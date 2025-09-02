import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadVerificationPhoto } from '../services/tourpackage/bookingVerification';

export default function VerificationPhotoModal({
  visible,
  onClose,
  booking,
  driverId,
  onSuccess
}) {
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  const requestCameraPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take verification photos.'
        );
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType?.Image ?? ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true, // Include base64 for easy upload
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.Image ?? ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadPhoto = async () => {
    if (!photo || !booking) return;

    setUploading(true);
    try {
      const photoData = {
        uri: photo.uri,
        base64: photo.base64,
        type: 'image/jpeg',
        filename: `verification_${booking.id}.jpg`
      };

      const result = await uploadVerificationPhoto(
        booking.id,
        driverId,
        photoData
      );

      if (result.success) {
        Alert.alert(
          'Success',
          'Verification photo uploaded successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setPhoto(null);
                onClose();
                if (onSuccess) onSuccess();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to upload photo');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload verification photo');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setPhoto(null)
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Verification Photo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.instructions}>
              Please upload a photo to verify the tour completion. This helps ensure 
              service quality and protects both drivers and tourists.
            </Text>

            {booking && (
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingLabel}>Booking Reference:</Text>
                <Text style={styles.bookingValue}>
                  {booking.booking_reference || booking.id}
                </Text>
                <Text style={styles.bookingLabel}>Package:</Text>
                <Text style={styles.bookingValue}>
                  {booking.package_name || 'Tour Package'}
                </Text>
              </View>
            )}

            {!photo ? (
              <View style={styles.photoOptions}>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={32} color="#B26A00" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={32} color="#B26A00" />
                  <Text style={styles.photoButtonText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photo.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={removePhoto}
                >
                  <Ionicons name="close-circle" size={32} color="#C62828" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>Photo Tips:</Text>
              <Text style={styles.tipItem}>• Include the tourist and location</Text>
              <Text style={styles.tipItem}>• Ensure good lighting</Text>
              <Text style={styles.tipItem}>• Show completion of service</Text>
              <Text style={styles.tipItem}>• Include any relevant landmarks</Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={uploading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.uploadButton,
                (!photo || uploading) && styles.disabledButton
              ]}
              onPress={uploadPhoto}
              disabled={!photo || uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload Photo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  bookingInfo: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  bookingLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  bookingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  photoOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  photoButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B26A00',
    borderStyle: 'dashed',
    flex: 0.45,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#B26A00',
    marginTop: 10,
    textAlign: 'center',
  },
  photoPreview: {
    position: 'relative',
    marginVertical: 20,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFF',
    borderRadius: 20,
  },
  tips: {
    backgroundColor: '#F0F8FF',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 8,
  },
  tipItem: {
    fontSize: 12,
    color: '#555',
    marginLeft: 10,
    marginVertical: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6B2E2B',
  },
  cancelButtonText: {
    color: '#6B2E2B',
    fontSize: 18,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#6B2E2B',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

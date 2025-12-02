import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { completeBookingWithPhoto } from '../../services/tourpackage/bookingVerification';
import { submitTripReport, submitDriverReport } from '../../services/reportService';
import { useAuth } from '../../hooks/useAuth';
import ReportModal from '../../components/ReportModal';

const MAROON = '#6B2E2B';

export default function CompletionPhotoScreen({ navigation, route }) {
  const { booking, driverId, eventId, eventType, eventDetails, onComplete } = route.params;
  const { user } = useAuth();
  const isSpecialEvent = eventType === 'special_event';
  const isDriver = user?.role === 'driver' || user?.role === 'driver-owner';
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tripCompleted, setTripCompleted] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  const pickImage = async (useCamera = false) => {
    const permissionResult = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission needed', `Please grant ${useCamera ? 'camera' : 'gallery'} permissions.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async () => {
    if (!photo) {
      Alert.alert('Error', 'Please select a photo first');
      return;
    }

    setUploading(true);
    try {
      let result;
      
      if (isSpecialEvent) {
        // Complete special event
        const { updateCustomRequestStatus } = require('../../services/specialpackage/customPackageRequest');
        result = await updateCustomRequestStatus(eventId, 'special_event', { 
          status: 'completed',
          completion_photo: photo 
        });
      } else {
        // Complete regular booking
        result = await completeBookingWithPhoto(booking.id, driverId, photo);
      }
      
      if (result.success) {
        setTripCompleted(true);
        Alert.alert(
          isSpecialEvent ? 'Event Completed!' : 'Trip Completed!',
          `Photo uploaded and ${isSpecialEvent ? 'event' : 'booking'} completed successfully. The customer has been notified.`
        );
        if (onComplete) onComplete();
      } else {
        Alert.alert('Error', result.error || 'Failed to upload photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleReport = async (reportData) => {
    setSubmittingReport(true);
    try {
      if (isDriver) {
        // Driver reporting tourist
        await submitTripReport(booking.id, driverId, reportData);
      } else {
        // Tourist reporting driver
        await submitDriverReport(booking.id, booking.driver_id, user.id, reportData);
      }
      setShowReportModal(false);
      Alert.alert(
        'Report Submitted',
        'Your report has been submitted and will be reviewed by admin. Unjustified reports may result in suspension.',
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isSpecialEvent ? 'Complete Event' : 'Complete Trip'}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Upload Completion Photo</Text>
          <Text style={styles.infoText}>
            Take or select a photo to complete the {isSpecialEvent ? 'event' : 'trip'}. Once uploaded, the {isSpecialEvent ? 'event' : 'booking'} will be automatically completed.
          </Text>
          {isSpecialEvent && eventDetails && (
            <View style={styles.eventDetails}>
              <Text style={styles.eventDetailText}>Event: {eventDetails.event_type}</Text>
              <Text style={styles.eventDetailText}>Customer: {eventDetails.customer_name}</Text>
              <Text style={styles.eventDetailText}>Date: {eventDetails.event_date}</Text>
            </View>
          )}
        </View>

        <View style={styles.photoSection}>
          {photo ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity 
                style={styles.changePhotoButton}
                onPress={() => setPhoto(null)}
              >
                <Ionicons name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={48} color="#999" />
              <Text style={styles.placeholderText}>No photo selected</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.cameraButton} 
            onPress={() => pickImage(true)}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.galleryButton} 
            onPress={() => pickImage(false)}
          >
            <Ionicons name="images" size={20} color={MAROON} />
            <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

        {!tripCompleted ? (
          <TouchableOpacity 
            style={[styles.uploadButton, (!photo || uploading) && styles.disabledButton]}
            onPress={uploadPhoto}
            disabled={!photo || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>{isSpecialEvent ? 'Complete Event' : 'Complete Trip'}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.completedActions}>
            <TouchableOpacity 
              style={styles.reportButton}
              onPress={() => setShowReportModal(true)}
            >
              <Ionicons name="flag" size={20} color="#DC3545" />
              <Text style={styles.reportButtonText}>Report Issue</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={() => navigation.navigate('Main')}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        loading={submittingReport}
        reporterType={isDriver ? 'driver' : 'tourist'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    backgroundColor: MAROON,
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  eventDetails: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  eventDetailText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 250,
    height: 200,
    borderRadius: 12,
  },
  changePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: 250,
    height: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 16,
    color: '#999',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cameraButton: {
    flex: 1,
    backgroundColor: MAROON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  galleryButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: MAROON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryButtonText: {
    color: MAROON,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  completedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reportButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DC3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  reportButtonText: {
    color: '#DC3545',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
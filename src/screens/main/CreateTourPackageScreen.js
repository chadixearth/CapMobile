import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import * as ImagePicker from 'expo-image-picker';
import { createTourPackage, updateTourPackage, getPickupPoints, getDropoffPoints } from '../../services/tourPackageService';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function CreateTourPackageScreen({ navigation, route }) {
  const isEdit = route?.params?.package;
  const existingPackage = route?.params?.package;

  const [formData, setFormData] = useState({
    package_name: '',
    description: '',
    price: '',
    destination: '',
    pickup_location: '',
    duration_hours: '',
    max_pax: '',
    available_days_data: [],
    expiration_date_data: '',
    start_time: '',
    photos: [],
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [dropoffPoints, setDropoffPoints] = useState([]);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPickups, setLoadingPickups] = useState(true);
  const [loadingDropoffs, setLoadingDropoffs] = useState(false);
  const [photos, setPhotos] = useState([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchPickupPoints();
    if (isEdit && existingPackage) {
      setFormData({
        package_name: existingPackage.package_name || '',
        description: existingPackage.description || '',
        price: existingPackage.price?.toString() || '',
        destination: existingPackage.destination || '',
        pickup_location: existingPackage.pickup_location || '',
        duration_hours: existingPackage.duration_hours?.toString() || '',
        max_pax: existingPackage.max_pax?.toString() || '',
        available_days_data: existingPackage.available_days_data || [],
        expiration_date_data: existingPackage.expiration_date_data || '',
        start_time: existingPackage.start_time || '',
      });
      if (existingPackage.expiration_date_data) {
        setSelectedDate(new Date(existingPackage.expiration_date_data));
      }
      if (existingPackage.start_time) {
        const [hours, minutes] = existingPackage.start_time.split(':');
        const timeDate = new Date();
        timeDate.setHours(parseInt(hours), parseInt(minutes));
        setSelectedTime(timeDate);
      }
    }
  }, []);

  const fetchPickupPoints = async () => {
    try {
      const result = await getPickupPoints();
      if (result.success) {
        setPickupPoints(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching pickup points:', error);
    } finally {
      setLoadingPickups(false);
    }
  };

  const fetchDropoffPoints = async (pickupId, pickupName) => {
    try {
      setLoadingDropoffs(true);
      const result = await getDropoffPoints(pickupId, pickupName);
      if (result.success) {
        const points = result.data || [];
        setDropoffPoints(points);
        
        // Show feedback to user
        if (points.length > 0) {
          Alert.alert(
            'Pickup Selected',
            `Found ${points.length} compatible drop-off locations for ${pickupName}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'No Drop-off Points',
            `No compatible drop-off points found for ${pickupName}. You can still create the package with a custom destination.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        console.error('Error fetching dropoff points:', result.error);
        setDropoffPoints([]);
      }
    } catch (error) {
      console.error('Error fetching dropoff points:', error);
      setDropoffPoints([]);
    } finally {
      setLoadingDropoffs(false);
    }
  };

  const showDropoffModal = () => {
    Alert.alert(
      'Select Drop-off Location',
      'Choose from available locations:',
      [
        ...dropoffPoints.map(point => ({
          text: `${point.name}${point.description ? ` - ${point.description}` : ''}`,
          onPress: () => {
            updateField('dropoff_lat', point.latitude);
            updateField('dropoff_lng', point.longitude);
            updateField('destination', point.name);
          }
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      available_days_data: prev.available_days_data.includes(day)
        ? prev.available_days_data.filter(d => d !== day)
        : [...prev.available_days_data, day]
    }));
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      updateField('expiration_date_data', date.toISOString().split('T')[0]);
    }
  };

  const onTimeChange = (event, time) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedTime(time);
      const timeString = time.toTimeString().split(' ')[0].substring(0, 5);
      updateField('start_time', timeString);
    }
  };

  const handleDurationConfirm = () => {
    try {
      // Validate duration values
      const hours = parseInt(durationHours) || 0;
      const minutes = parseInt(durationMinutes) || 0;
      
      // Ensure minimum duration of 1 hour
      if (hours === 0 && minutes === 0) {
        Alert.alert('Invalid Duration', 'Duration must be at least 1 hour');
        return;
      }
      
      const totalHours = hours + (minutes / 60);
      const displayText = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
      
      updateField('duration_hours', totalHours.toString());
      updateField('duration_display', displayText);
      setShowDurationPicker(false);
    } catch (error) {
      console.error('Error setting duration:', error);
      Alert.alert('Error', 'Failed to set duration. Please try again.');
    }
  };

  const pickImages = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit Reached', 'You can add up to 5 photos only.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(asset => ({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `photo_${Date.now()}.jpg`
      }));
      const updatedPhotos = [...photos, ...newPhotos];
      console.log('📸 Photos selected:', updatedPhotos.length);
      console.log('Photo URIs:', updatedPhotos.map(p => p.uri));
      setPhotos(updatedPhotos);
      updateField('photos', updatedPhotos);
    }
  };
  
  const removePhoto = (index) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);
    updateField('photos', updatedPhotos);
  };

  const validateForm = () => {
    if (!formData.package_name.trim()) {
      Alert.alert('Validation Error', 'Package name is required');
      return false;
    }
    if (formData.package_name.length < 5) {
      Alert.alert('Validation Error', 'Package name must be at least 5 characters long');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Validation Error', 'Description is required');
      return false;
    }
    if (formData.description.length < 20) {
      Alert.alert('Validation Error', 'Description must be at least 20 characters long');
      return false;
    }
    if (!formData.price || isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      Alert.alert('Validation Error', 'Valid price is required');
      return false;
    }
    if (parseFloat(formData.price) < 100) {
      Alert.alert('Validation Error', 'Minimum price is ₱100');
      return false;
    }
    if (!formData.destination || !formData.destination.trim()) {
      Alert.alert('Validation Error', 'Please select a drop location');
      return false;
    }
    if (!formData.pickup_location || !formData.pickup_location.trim()) {
      Alert.alert('Validation Error', 'Please select a pickup location');
      return false;
    }
    if (!formData.duration_hours || isNaN(parseFloat(formData.duration_hours)) || parseFloat(formData.duration_hours) < 1) {
      Alert.alert('Validation Error', 'Duration must be at least 1 hour');
      return false;
    }
    if (!formData.max_pax || parseInt(formData.max_pax) < 1) {
      Alert.alert('Validation Error', 'Maximum passengers must be at least 1');
      return false;
    }
    if (formData.available_days_data.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one available day');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const packageData = {
        ...formData,
        price: parseFloat(formData.price),
        duration_hours: parseFloat(formData.duration_hours) || 1,
        max_pax: parseInt(formData.max_pax) || 1,
      };
      
      console.log('📦 Submitting package with photos:', packageData.photos?.length || 0);
      if (packageData.photos) {
        console.log('Photo details:', packageData.photos);
      }

      const result = isEdit
        ? await updateTourPackage(existingPackage.id, packageData)
        : await createTourPackage(packageData);

      if (result.success) {
        Alert.alert(
          'Success',
          `Tour package ${isEdit ? 'updated' : 'created'} successfully`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        if (result.code === 'ACTIVE_PACKAGE_EXISTS') {
          Alert.alert(
            'Cannot Create Package',
            result.error,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'View Active Package',
                onPress: () => {
                  navigation.goBack();
                  navigation.navigate('PackageDetails', { package: result.activePackage });
                }
              }
            ]
          );
        } else {
          Alert.alert('Error', result.error || `Failed to ${isEdit ? 'update' : 'create'} package`);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'create'} package`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Package' : 'Create Package'}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Package Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Package Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.package_name}
              onChangeText={(value) => updateField('package_name', value)}
              placeholder="Enter package name"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => updateField('description', value)}
              placeholder="Describe your tour package"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>Price (₱) *</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(value) => updateField('price', value)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>

          {/* Photos */}
          <View style={styles.field}>
            <Text style={styles.label}>Package Photos ({photos.length}/5)</Text>
            <TouchableOpacity
              style={[styles.photoButton, photos.length >= 5 && styles.disabledButton]}
              onPress={pickImages}
              disabled={photos.length >= 5}
            >
              <Ionicons name="camera-outline" size={20} color={photos.length >= 5 ? '#ccc' : MAROON} />
              <Text style={[styles.photoButtonText, photos.length >= 5 && { color: '#ccc' }]}>
                {photos.length === 0 ? 'Add Photos' : `Add More Photos (${5 - photos.length} remaining)`}
              </Text>
            </TouchableOpacity>
            
            {photos.length > 0 && (
              <ScrollView horizontal style={styles.photosContainer} showsHorizontalScrollIndicator={false}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>



          {/* Pickup Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Pickup Location</Text>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => navigation.navigate('MapView', {
                mode: 'selectPickup',
                onLocationSelect: async (location) => {
                  updateField('pickup_location', location.name);
                  updateField('pickup_lat', location.latitude);
                  updateField('pickup_lng', location.longitude);
                  
                  // Clear existing dropoff selection
                  updateField('destination', '');
                  updateField('dropoff_lat', '');
                  updateField('dropoff_lng', '');
                  setDropoffPoints([]);
                  
                  // Store selected pickup point for dropoff fetching
                  setSelectedPickupPoint({
                    id: location.id,
                    name: location.name,
                    latitude: location.latitude,
                    longitude: location.longitude
                  });
                  
                  // Fetch compatible dropoff points
                  await fetchDropoffPoints(location.id, location.name);
                }
              })}
            >
              <Ionicons name="map-outline" size={20} color={MAROON} />
              <Text style={styles.mapButtonText}>
                {formData.pickup_location || 'Select Pickup Location'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Drop Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Drop Location</Text>
            {!selectedPickupPoint ? (
              <View style={[styles.mapButton, styles.disabledButton]}>
                <Ionicons name="map-outline" size={20} color="#ccc" />
                <Text style={[styles.mapButtonText, { color: '#ccc' }]}>Select pickup location first</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => {
                  if (dropoffPoints.length === 0) {
                    Alert.alert('No Drop-off Points', 'No compatible drop-off points found for the selected pickup location.');
                    return;
                  }
                  
                  // Show dropoff selection modal
                  Alert.alert(
                    'Select Drop-off Location',
                    'Choose from available drop-off points:',
                    [
                      ...dropoffPoints.slice(0, 3).map(point => ({
                        text: point.name,
                        onPress: () => {
                          updateField('dropoff_lat', point.latitude);
                          updateField('dropoff_lng', point.longitude);
                          updateField('destination', point.name);
                        }
                      })),
                      ...(dropoffPoints.length > 3 ? [{
                        text: 'More options...',
                        onPress: () => showDropoffModal()
                      }] : []),
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                <Ionicons name="map-outline" size={20} color={MAROON} />
                <Text style={styles.mapButtonText}>
                  {formData.destination || `Select from ${dropoffPoints.length} available locations`}
                </Text>
                {loadingDropoffs && <ActivityIndicator size="small" color={MAROON} />}
              </TouchableOpacity>
            )}
          </View>

          {/* Duration & Max Pax */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Duration *</Text>
              <TouchableOpacity
                style={styles.durationButton}
                onPress={() => setShowDurationPicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={MAROON} />
                <Text style={styles.durationButtonText}>
                  {formData.duration_display || formData.duration_hours ? 
                    (formData.duration_display || `${formData.duration_hours}h`) : 
                    'Set Duration'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Max Passengers</Text>
              <TextInput
                style={styles.input}
                value={formData.max_pax}
                onChangeText={(value) => updateField('max_pax', value)}
                placeholder="6"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Available Days */}
          <View style={styles.field}>
            <Text style={styles.label}>Available Days</Text>
            <View style={styles.daysContainer}>
              {daysOfWeek.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayOption,
                    formData.available_days_data.includes(day) && styles.selectedDay
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[
                    styles.dayText,
                    formData.available_days_data.includes(day) && styles.selectedDayText
                  ]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Time */}
          <View style={styles.field}>
            <Text style={styles.label}>Start Time</Text>
            <View style={styles.startTimeContainer}>
              <TouchableOpacity
                style={[styles.startTimeOption, !formData.start_time && styles.selectedStartTimeOption]}
                onPress={() => updateField('start_time', '')}
              >
                <Text style={[styles.startTimeOptionText, !formData.start_time && styles.selectedStartTimeOptionText]}>
                  None (Flexible)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.startTimeOption, formData.start_time && styles.selectedStartTimeOption]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={16} color={formData.start_time ? '#fff' : MAROON} />
                <Text style={[styles.startTimeOptionText, formData.start_time && styles.selectedStartTimeOptionText]}>
                  {formData.start_time || 'Set Fixed Time'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Choose "None" to let tourists pick their own time, or set a fixed start time
            </Text>
          </View>

          {/* Expiration Date */}
          <View style={styles.field}>
            <Text style={styles.label}>Expiration Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={MAROON} />
              <Text style={styles.dateButtonText}>
                {formData.expiration_date_data || 'Select Expiration Date'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="default"
              onChange={onTimeChange}
            />
          )}

          <Modal
            visible={showDurationPicker}
            transparent
            animationType="slide"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.durationPickerModal}>
                <Text style={styles.modalTitle}>Set Duration</Text>
                <View style={styles.pickerRow}>
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Hours</Text>
                    <TextInput
                      style={styles.durationInput}
                      value={durationHours.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 0;
                        if (num >= 0 && num <= 24) setDurationHours(num);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Minutes</Text>
                    <TextInput
                      style={styles.durationInput}
                      value={durationMinutes.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 0;
                        if (num >= 0 && num <= 59) setDurationMinutes(num);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowDurationPicker(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleDurationConfirm}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEdit ? 'Update Package' : 'Create Package'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    backgroundColor: MAROON,
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  mapButton: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mapButtonText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  dateButton: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  durationButton: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  durationButtonText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayOption: {
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    minWidth: 55,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedDay: {
    backgroundColor: MAROON,
    borderColor: MAROON,
    shadowColor: MAROON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayText: {
    fontSize: 14,
    color: '#666',
  },
  selectedDayText: {
    color: '#fff',
  },
  footer: {
    padding: 16,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: MAROON,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: MAROON,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoButton: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  photosContainer: {
    marginTop: 12,
  },
  photoItem: {
    position: 'relative',
    marginRight: 12,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  startTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  startTimeOption: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectedStartTimeOption: {
    backgroundColor: MAROON,
    borderColor: MAROON,
  },
  startTimeOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  selectedStartTimeOptionText: {
    color: '#fff',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationPickerModal: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: MAROON,
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pickerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  durationInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  confirmButton: {
    backgroundColor: MAROON,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createTourPackage, updateTourPackage, getPickupPoints } from '../../services/tourPackageService';

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
  });
  const [pickupPoints, setPickupPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPickups, setLoadingPickups] = useState(true);

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
      });
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

  const validateForm = () => {
    if (!formData.package_name.trim()) {
      Alert.alert('Error', 'Package name is required');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Description is required');
      return false;
    }
    if (!formData.price || isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      Alert.alert('Error', 'Valid price is required');
      return false;
    }
    if (!formData.destination || !formData.destination.trim()) {
      Alert.alert('Error', 'Please select a drop location');
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
        duration_hours: parseInt(formData.duration_hours) || 1,
        max_pax: parseInt(formData.max_pax) || 1,
      };

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
        Alert.alert('Error', result.error || `Failed to ${isEdit ? 'update' : 'create'} package`);
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



          {/* Pickup Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Pickup Location</Text>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => navigation.navigate('MapView', {
                mode: 'selectPickup',
                onLocationSelect: (location) => {
                  updateField('pickup_location', location.name);
                  updateField('pickup_lat', location.latitude);
                  updateField('pickup_lng', location.longitude);
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
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => navigation.navigate('MapView', {
                mode: 'selectDrop',
                onLocationSelect: (location) => {
                  updateField('dropoff_lat', location.latitude);
                  updateField('dropoff_lng', location.longitude);
                  updateField('destination', location.name);
                }
              })}
            >
              <Ionicons name="map-outline" size={20} color={MAROON} />
              <Text style={styles.mapButtonText}>
                {(formData.dropoff_lat && formData.dropoff_lng) ? 'Drop Location Selected' : 'Select Drop Location'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Duration & Max Pax */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Duration (hours)</Text>
              <TextInput
                style={styles.input}
                value={formData.duration_hours}
                onChangeText={(value) => updateField('duration_hours', value)}
                placeholder="4"
                keyboardType="numeric"
              />
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

          {/* Expiration Date */}
          <View style={styles.field}>
            <Text style={styles.label}>Expiration Date</Text>
            <TextInput
              style={styles.input}
              value={formData.expiration_date_data}
              onChangeText={(value) => updateField('expiration_date_data', value)}
              placeholder="YYYY-MM-DD"
            />
          </View>
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
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapButtonText: {
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 50,
    alignItems: 'center',
  },
  selectedDay: {
    backgroundColor: MAROON,
    borderColor: MAROON,
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
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
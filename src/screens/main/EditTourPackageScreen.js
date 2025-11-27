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
import { driverUpdateTourPackage } from '../../services/tourPackageService';

const MAROON = '#6B2E2B';
const BG = '#F8F8F8';
const CARD = '#FFFFFF';

export default function EditTourPackageScreen({ navigation, route }) {
  const existingPackage = route?.params?.package;

  const [formData, setFormData] = useState({
    package_name: '',
    description: '',
    price: '',
    destination: '',
    pickup_location: '',
    duration_hours: '',
    duration_minutes: '',
    max_pax: '',
    available_days: [],
    expiration_date: '',
  });
  const [loading, setLoading] = useState(false);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (existingPackage) {
      setFormData({
        package_name: existingPackage.package_name || '',
        description: existingPackage.description || '',
        price: existingPackage.price?.toString() || '',
        destination: existingPackage.destination || '',
        pickup_location: existingPackage.pickup_location || '',
        duration_hours: existingPackage.duration_hours?.toString() || '',
        duration_minutes: existingPackage.duration_minutes?.toString() || '0',
        max_pax: existingPackage.max_pax?.toString() || '',
        available_days: existingPackage.available_days || [],
        expiration_date: existingPackage.expiration_date || '',
      });
    }
  }, [existingPackage]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter(d => d !== day)
        : [...prev.available_days, day]
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
    if (!formData.destination.trim()) {
      Alert.alert('Error', 'Destination is required');
      return false;
    }
    if (!formData.duration_hours || isNaN(parseFloat(formData.duration_hours)) || parseFloat(formData.duration_hours) < 1) {
      Alert.alert('Error', 'Duration must be at least 1 hour');
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
        duration_minutes: parseInt(formData.duration_minutes) || 0,
        max_pax: parseInt(formData.max_pax) || 1,
      };

      const result = await driverUpdateTourPackage(existingPackage.id, packageData);

      if (result.success) {
        Alert.alert(
          'Success',
          'Tour package updated successfully',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        if (result.code === 'UNFINISHED_BOOKINGS') {
          Alert.alert(
            'Cannot Edit Package',
            result.error,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to update package');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update package');
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
        <Text style={styles.headerTitle}>Edit Package</Text>
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
            <TextInput
              style={styles.input}
              value={formData.pickup_location}
              onChangeText={(value) => updateField('pickup_location', value)}
              placeholder="Enter pickup location"
            />
          </View>

          {/* Destination */}
          <View style={styles.field}>
            <Text style={styles.label}>Destination *</Text>
            <TextInput
              style={styles.input}
              value={formData.destination}
              onChangeText={(value) => updateField('destination', value)}
              placeholder="Enter destination"
            />
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
                    formData.available_days.includes(day) && styles.selectedDay
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[
                    styles.dayText,
                    formData.available_days.includes(day) && styles.selectedDayText
                  ]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
            <Text style={styles.submitButtonText}>Update Package</Text>
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
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
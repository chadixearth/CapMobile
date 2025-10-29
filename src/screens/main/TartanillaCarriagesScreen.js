import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import driverService from '../../services/carriages/fetchDriver';
import { apiBaseUrl } from '../../services/networkConfig';

import { supabase } from '../../services/supabase';
import { getMyCarriages, assignDriverToCarriage, createCarriage } from '../../services/tartanillaService';
import { useAuth } from '../../hooks/useAuth';
import carriageService from '../../services/tourpackage/fetchCarriage';

const { width } = Dimensions.get('window');
const MAROON = '#6B2E2B';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333';

export default function TartanillaCarriagesScreen({ navigation }) {
  const auth = useAuth();
  const [carriages, setCarriages] = useState([]);
  
  // Debug effect to track carriages state changes
  useEffect(() => {
    console.log('=== CARRIAGES STATE CHANGED ===');
    console.log('Carriages state:', carriages);
    console.log('Carriages length:', carriages.length);
    console.log('Is array:', Array.isArray(carriages));
    console.log('First carriage:', carriages[0]);
    console.log('================================');
  }, [carriages]);

  // Debug render - only in development
  if (__DEV__) {
    console.log('RENDER DEBUG - Loading:', loading, 'Auth loading:', auth.loading, 'Authenticated:', auth.isAuthenticated);
  }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [newCarriage, setNewCarriage] = useState({
    plate_number: '', 
    capacity: '4',
    notes: ''
  });
  const [addingCarriage, setAddingCarriage] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [currentApiUrl, setCurrentApiUrl] = useState('');
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedCarriage, setSelectedCarriage] = useState(null);
  const [assigningDriver, setAssigningDriver] = useState(false);
  const [driverCache, setDriverCache] = useState({}); // id -> driver details
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCarriage, setEditingCarriage] = useState(null);
  const [editForm, setEditForm] = useState({ capacity: '4', status: 'available', notes: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const normalizedStatusRef = useRef(new Set()); // ids already normalized from driver_assigned -> available

  // All callback functions need to be defined before the conditional return
  const fetchAllDrivers = async () => {
    try {
      const drivers = await driverService.getAllDrivers();
      const list = Array.isArray(drivers) ? drivers : [];
      setAvailableDrivers(list);
      // Seed cache by id and user_id for immediate resolution in cards
      if (list.length) {
        const updates = {};
        list.forEach(d => {
          if (d?.id) updates[String(d.id)] = d;
          if (d?.user_id) updates[String(d.user_id)] = d;
        });
        if (Object.keys(updates).length) {
          setDriverCache(prev => ({ ...prev, ...updates }));
        }
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      Alert.alert('Error', error.message || 'Failed to load drivers');
    }
  };

  const handleAssignDriver = async (driver) => {
    if (!selectedCarriage || !driver?.id) return;
    
    setAssigningDriver(true);
    try {
      const result = await assignDriverToCarriage(selectedCarriage.id, driver.id);
      
      if (result.success) {
        // Optimistically seed the cache so UI shows name/email immediately (by id and user_id)
        setDriverCache(prev => ({ 
          ...prev, 
          [String(driver.id)]: driver,
          ...(driver.user_id ? { [String(driver.user_id)]: driver } : {})
        }));
        // Optimistically update the specific carriage locally for instant feedback
        setCarriages(prev => prev.map(c => c.id === selectedCarriage.id 
          ? { 
              ...c, 
              assigned_driver_id: driver.id,
              assigned_driver: driver,
              status: 'waiting_driver_acceptance'
            }
          : c
        ));
        setShowDriverModal(false);
        Alert.alert('Success', 'Driver invitation sent! Waiting for driver acceptance.', [
          {
            text: 'OK',
            onPress: async () => {
              // Force refresh the carriages list
              await fetchUserAndCarriages();
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to assign driver');
      }
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver');
    } finally {
      setAssigningDriver(false);
    }
  };

  const openDriverModal = async (carriage) => {
    setSelectedCarriage(carriage);
    setShowDriverModal(true);
    await fetchAllDrivers();
  };

  const pickImage = async () => {
    try {
      const remainingSlots = 5 - selectedImages.length;
      if (remainingSlots <= 0) {
        Alert.alert('Limit Reached', 'You can only upload up to 5 photos per carriage.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: false, // Disabled to fix warning with multiple selection
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
      });

      if (!result.canceled && result.assets) {
        const newImages = [...selectedImages, ...result.assets];
        setSelectedImages(newImages.slice(0, 5)); // Ensure max 5 images
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const remainingSlots = 5 - selectedImages.length;
      if (remainingSlots <= 0) {
        Alert.alert('Limit Reached', 'You can only upload up to 5 photos per carriage.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'Images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = [...selectedImages, ...result.assets];
        setSelectedImages(newImages.slice(0, 5)); // Ensure max 5 images
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImageToSupabase = async (imageUri, index) => {
    try {
      // Create a unique filename with index
      const timestamp = Date.now();
      const filename = `carriage_${timestamp}_${index}.jpg`;
      
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to Uint8Array
      const binaryData = atob(base64);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      
      // Upload to Supabase storage using service role
      const { data, error } = await supabase.storage
        .from('carriage-photos')
        .upload(filename, bytes, {
          contentType: 'image/jpeg',
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('carriage-photos')
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const uploadAllImages = async (images) => {
    try {
      setUploadingImage(true);
      
      const uploadPromises = images.map((image, index) => 
        uploadImageToSupabase(image.uri, index)
      );
      
      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setSelectedImages([]);
  };

  const fetchUserAndCarriages = useCallback(async () => {
    try {
      setLoading(true);

      // Use the authenticated user from auth hook
      const currentUser = auth.user;
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view your carriages');
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Show carriages based on role
      const role = currentUser.role;
      if (role !== 'owner' && role !== 'driver' && role !== 'driver-owner') {
        setCarriages([]);
        setLoading(false);
        return;
      }

      const result = await getMyCarriages();
      console.log('getMyCarriages result:', result);
      if (result.success) {
        const carriageData = result.data || [];
        console.log('About to set carriages state with:', carriageData);
        console.log('Carriages array length:', carriageData.length);
        console.log('Carriages array type:', Array.isArray(carriageData));
        console.log('First carriage data:', carriageData[0]);
        
        // Force state update with a new array reference
        const newCarriages = Array.isArray(carriageData) ? [...carriageData] : [];
        setCarriages(newCarriages);
        console.log('setCarriages called with:', newCarriages.length, 'items');
        
        // Force a re-render by updating loading state
        setTimeout(() => {
          console.log('Current carriages state after timeout:', carriages.length);
        }, 100);
      } else {
        console.error('Error loading carriages:', result.error);
        setCarriages([]);
      }
    } catch (err) {
      console.error('Failed to load carriages:', err);
      let errorMessage = 'Failed to load carriages';
      
      if (err.message.includes('Network request failed')) {
        errorMessage = `Network error: Please check your internet connection and ensure the server is running at ${apiBaseUrl().replace('/api', '')}`;
      } else if (err.message.includes('HTTP error')) {
        errorMessage = `Server error: ${err.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [auth.user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (auth.user?.role === 'owner' || auth.user?.role === 'driver' || auth.user?.role === 'driver-owner') {
        const result = await getMyCarriages();
        if (result.success) {
          setCarriages(result.data || []);
        }
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [auth.user]);

  useEffect(() => {
    // Handle authentication redirect
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
      return;
    }
    
    // Load data when authenticated
    if (auth.isAuthenticated) {
      fetchUserAndCarriages();
    }
  }, [auth.loading, auth.isAuthenticated, fetchUserAndCarriages, navigation]);

  // When carriages change, hydrate missing driver details into a local cache
  useEffect(() => {
    const fetchMissingDrivers = async () => {
      try {
        const idsToFetch = (carriages || [])
          .map(c => c.assigned_driver ? null : c.assigned_driver_id)
          .filter(id => !!id && !driverCache[id]);

        if (idsToFetch.length === 0) return;

        let unresolved = new Set(idsToFetch);

        // First, try per-ID fetches
        for (const id of idsToFetch) {
          try {
            const d = await driverService.getDriverById(id);
            if (d) {
              setDriverCache(prev => ({ ...prev, [id]: d }));
              unresolved.delete(id);
            }
          } catch (e) {
            // will try bulk fallback below
          }
        }

        // Bulk fallback if any unresolved
        if (unresolved.size > 0) {
          try {
            const all = await driverService.getAllDrivers();
            const byId = new Map();
            const byUserId = new Map();
            (Array.isArray(all) ? all : []).forEach(d => {
              if (d?.id) byId.set(String(d.id), d);
              if (d?.user_id) byUserId.set(String(d.user_id), d);
            });

            const updates = {};
            unresolved.forEach(id => {
              const key = String(id);
              const d = byId.get(key) || byUserId.get(key);
              if (d) updates[key] = d;
            });
            if (Object.keys(updates).length > 0) {
              setDriverCache(prev => ({ ...prev, ...updates }));
            }
          } catch (e) {
            // swallow; not critical for UI
          }
        }
      } catch (e) {
        // ignore
      }
    };
    fetchMissingDrivers();
  }, [carriages, driverCache]);

  // Normalize backend status: convert 'driver_assigned' to 'available' once per carriage
  useEffect(() => {
    (async () => {
      try {
        const items = Array.isArray(carriages) ? carriages : [];
        const toNormalize = items.filter(c => c?.id && c.status === 'driver_assigned' && !normalizedStatusRef.current.has(c.id));
        for (const c of toNormalize) {
          try {
            await carriageService.updateCarriage(c.id, { status: 'available' });
            normalizedStatusRef.current.add(c.id);
            // Optimistically update local state
            setCarriages(prev => prev.map(x => x.id === c.id ? { ...x, status: 'available' } : x));
          } catch (e) {
            // Skip failures but don't loop endlessly
            normalizedStatusRef.current.add(c.id);
          }
        }
      } catch (_) {
        // ignore
      }
    })();
  }, [carriages]);

  // Show loading while checking authentication
  if (auth.loading) {
    return (
      <View style={styles.container}>
        <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!auth.isAuthenticated) {
    return null;
  }

  const validateForm = () => {
    const errors = {};
    if (!newCarriage.plate_number.trim()) {
      errors.plate_number = 'Plate number is required';
    } else if (!/^[A-Z0-9-]+$/i.test(newCarriage.plate_number)) {
      errors.plate_number = 'Enter a valid plate number';
    }
    
    const capacity = parseInt(newCarriage.capacity);
    if (isNaN(capacity) || capacity < 1 || capacity > 10) {
      errors.capacity = 'Capacity must be between 1 and 10';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCarriage = async () => {
    if (!validateForm()) {
      return;
    }

    setAddingCarriage(true);
    try {
      let imageUrls = [];
      
      // Upload images if selected
      if (selectedImages.length > 0) {
        try {
          imageUrls = await uploadAllImages(selectedImages);
        } catch (error) {
          console.error('Error uploading images:', error);
          Alert.alert('Error', 'Failed to upload images. Please try again.');
          setAddingCarriage(false);
          return;
        }
      }

      // Format the data exactly as the API expects it
      const carriageData = {
        plate_number: newCarriage.plate_number.trim(),
        capacity: parseInt(newCarriage.capacity) || 4,
        status: 'available', // New carriages should be available for rent
        eligibility: newCarriage.eligibility || 'eligible',
        notes: newCarriage.notes || '',
        image_urls: imageUrls
      };
      
      // Remove any empty fields
      Object.keys(carriageData).forEach(key => {
        if (carriageData[key] === '' || carriageData[key] === null || carriageData[key] === undefined) {
          delete carriageData[key];
        }
      });

      console.log('Creating carriage with data:', carriageData);
      
      // First, check if a carriage with this plate number already exists
      const existingResult = await getMyCarriages();
      const existingCarriages = existingResult.success ? existingResult.data : [];
      const duplicate = Array.isArray(existingCarriages) && 
        existingCarriages.some(carriage => 
          carriage.plate_number?.toLowerCase() === carriageData.plate_number?.toLowerCase()
        );
      
      if (duplicate) {
        Alert.alert('Error', 'A carriage with this plate number already exists');
        setAddingCarriage(false);
        return;
      }

      // Use the service function
      const result = await createCarriage(carriageData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add carriage');
      }

      // Reset form and close modal on success
      setShowAddModal(false);
      setNewCarriage({
        plate_number: '',
        capacity: '4',
        notes: ''
      });
      setSelectedImages([]);
      
      // Show success message
      Alert.alert('Success', 'Carriage added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Refresh the list after a short delay to ensure the modal is closed
            setTimeout(() => fetchUserAndCarriages(), 100);
          }
        }
      ]);
    } catch (error) {
      console.error('Error adding carriage:', error);
      
      // Check for authentication errors
      if (error.message.includes('Owner not found') || error.message.includes('not authenticated')) {
        Alert.alert('Session Expired', 'Please log in again.', [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            }
          }
        ]);
        return;
      }
      
      let errorMessage = 'Failed to add carriage. Please try again.';
      
      if (error.message.includes('plate_number')) {
        errorMessage = 'Invalid plate number format. Please check and try again.';
      } else if (error.message.includes('status')) {
        errorMessage = 'Invalid status value. Please select a valid status.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Invalid data. Please check all fields and try again.';
      } else if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setAddingCarriage(false);
    }
  };

  const openEditModal = (carriage) => {
    setEditingCarriage(carriage);
    setEditForm({
      capacity: String(carriage.capacity || '4'),
      status: (carriage.status && carriage.status !== 'driver_assigned') ? carriage.status : 'available',
      notes: carriage.notes || ''
    });
    setShowEditModal(true);
  };

  const validateEditForm = () => {
    const errors = {};
    const cap = parseInt(editForm.capacity);
    if (isNaN(cap) || cap < 1 || cap > 10) {
      errors.capacity = 'Capacity must be between 1 and 10';
    }
    if (!editForm.status) {
      errors.status = 'Status is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateCarriage = async () => {
    if (!editingCarriage) return;
    if (!validateEditForm()) return;
    setSavingEdit(true);
    try {
      const updates = {
        capacity: parseInt(editForm.capacity) || undefined,
        status: editForm.status,
        notes: editForm.notes ?? ''
      };
      // Clean undefined
      Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

      await carriageService.updateCarriage(editingCarriage.id, updates);

      setShowEditModal(false);
      setEditingCarriage(null);
      // Refresh
      await fetchUserAndCarriages();
      Alert.alert('Success', 'Carriage updated successfully');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update carriage');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderCarriageCard = (carriage) => {
    const statusConfig = {
      available: { icon: 'checkmark-circle', color: '#10B981', bgColor: '#ECFDF5', text: 'Available' },
      in_use: { icon: 'time', color: '#EF4444', bgColor: '#FEF2F2', text: 'In Use' },
      maintenance: { icon: 'build', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Maintenance' },
      waiting_driver_acceptance: { icon: 'hourglass-outline', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Awaiting Driver' },
      driver_assigned: { icon: 'person-circle', color: '#3B82F6', bgColor: '#EFF6FF', text: 'Driver Assigned' },
      not_usable: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEF2F2', text: 'Not Usable' },
      suspended: { icon: 'pause-circle', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Suspended' },
      out_of_service: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEF2F2', text: 'Out of Service' },
      default: { icon: 'help-circle', color: '#6B7280', bgColor: '#F9FAFB', text: 'Unknown' },
    };

    const statusKey = carriage.status?.toLowerCase() || 'default';
    const status = statusConfig[statusKey] || statusConfig.default;
    const isDriver = user?.role === 'driver';
    const cached = driverCache[carriage.assigned_driver_id];

    const buildName = (d) => {
      if (!d) return null;
      return (
        d.name ||
        d.full_name || d.fullName ||
        (d.first_name || d.last_name ? `${d.first_name || ''} ${d.last_name || ''}`.trim() : null) ||
        d.user?.name ||
        (d.user && (d.user.first_name || d.user.last_name) ? `${d.user.first_name || ''} ${d.user.last_name || ''}`.trim() : null) ||
        d.username ||
        d.email || (typeof d.email === 'string' ? d.email : null) ||
        null
      );
    };

    const driverName = buildName(carriage.assigned_driver) || buildName(cached) || (carriage.assigned_driver_id ? 'Unknown Driver' : 'Unassigned');
    const driverEmail = carriage.assigned_driver?.email || cached?.email || (carriage.assigned_driver_id ? 'No email' : '');
    const driverPhone = carriage.assigned_driver?.phone || carriage.assigned_driver?.mobile || carriage.assigned_driver?.phone_number || cached?.phone || cached?.mobile || cached?.phone_number || '';
    const hasDriverSelected = !!(carriage.assigned_driver_id || carriage.assigned_driver);
    const assignmentStatus = hasDriverSelected && carriage.status === 'waiting_driver_acceptance' ? 'Waiting for driver acceptance' : null;

    return (
      <View key={carriage.id} style={styles.carriageCard}>
        <View style={styles.cardHeader}>
          <View style={styles.plateSection}>
            <View style={styles.plateIcon}>
              <Ionicons name="car" size={20} color={MAROON} />
            </View>
            <Text style={styles.plateNumber}>{carriage.plate_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Ionicons name="person-outline" size={16} color="#666" />
                <Text style={styles.infoLabel}>Driver</Text>
              </View>
              <Text style={styles.infoValue} numberOfLines={1}>{driverName}</Text>
              {driverEmail && <Text style={styles.infoSubtext} numberOfLines={1}>{driverEmail}</Text>}
              {driverPhone && <Text style={styles.infoSubtext} numberOfLines={1}>📱 {driverPhone}</Text>}
            </View>
            
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.infoLabel}>Capacity</Text>
              </View>
              <Text style={styles.infoValue}>{carriage.capacity || 'N/A'}</Text>
              <Text style={styles.infoSubtext}>persons</Text>
            </View>
          </View>

          {assignmentStatus && (
            <View style={styles.alertBox}>
              <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
              <Text style={styles.alertText}>{assignmentStatus}</Text>
            </View>
          )}

          {carriage.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText} numberOfLines={2}>{carriage.notes}</Text>
            </View>
          )}

          {!isDriver && (
            <View style={styles.actionButtons}>
              {!hasDriverSelected && (
                <TouchableOpacity 
                  style={styles.assignButton}
                  onPress={() => openDriverModal(carriage)}
                  disabled={assigningDriver}
                >
                  <Ionicons name="person-add-outline" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Assign Driver</Text>
                </TouchableOpacity>
              )}
              {hasDriverSelected && carriage.status === 'waiting_driver_acceptance' && (
                <TouchableOpacity 
                  style={styles.changeButton}
                  onPress={() => openDriverModal(carriage)}
                  disabled={assigningDriver}
                >
                  <Ionicons name="sync-outline" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Change Driver</Text>
                </TouchableOpacity>
              )}
              {hasDriverSelected && carriage.status !== 'waiting_driver_acceptance' && (
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.reassignButton}
                    onPress={() => openDriverModal(carriage)}
                    disabled={assigningDriver}
                  >
                    <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Reassign</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditModal(carriage)}
                    disabled={savingEdit}
                  >
                    <Ionicons name="pencil-outline" size={16} color={MAROON} />
                    <Text style={[styles.buttonText, { color: MAROON }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDriverModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showDriverModal}
      onRequestClose={() => !assigningDriver && setShowDriverModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Driver</Text>
            <TouchableOpacity 
              onPress={() => !assigningDriver && setShowDriverModal(false)}
              disabled={assigningDriver}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            {availableDrivers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No drivers found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Try again later.
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableDrivers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.driverItem, assigningDriver && styles.driverItemDisabled]}
                    onPress={() => handleAssignDriver(item)}
                    disabled={assigningDriver}
                    activeOpacity={0.7}
                  >
                    <View style={styles.driverAvatar}>
                      <Ionicons name="person-circle-outline" size={40} color={MAROON} />
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>
                        {(
                          item.name ||
                          item.full_name || item.fullName ||
                          (item.first_name || item.last_name ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : null) ||
                          item.user?.name ||
                          (item.user && (item.user.first_name || item.user.last_name) ? `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim() : null) ||
                          item.username ||
                          item.email ||
                          'Unknown Driver'
                        )}
                      </Text>
                      <Text style={styles.driverEmail} numberOfLines={1}>
                        {item.email || 'No email'}
                      </Text>
                      {(item.phone || item.mobile || item.phone_number) && (
                        <Text style={styles.driverPhone} numberOfLines={1}>
                          📱 {item.phone || item.mobile || item.phone_number}
                        </Text>
                      )}
                      {(item.address || item.location) && (
                        <Text style={styles.driverPhone} numberOfLines={1}>
                          📍 {item.address || item.location}
                        </Text>
                      )}
                      <Text style={styles.driverRole}>
                        {item.role || 'driver'}
                      </Text>
                    </View>
                    <View style={styles.selectDriverButton}>
                      <Ionicons name="chevron-forward" size={20} color={MAROON} />
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.divider} />}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEmptyState = () => {
    const isDriver = user?.role === 'driver';
    return (
      <View style={styles.emptyState}>
        <Ionicons name="car-outline" size={48} color="#ccc" />
        <Text style={styles.emptyStateText}>
          {isDriver ? 'No tartanilla assigned' : 'No carriages found'}
        </Text>
        <Text style={styles.emptyStateSubtext}>
          {isDriver 
            ? 'Contact your owner to get a tartanilla assigned to you'
            : 'Add your first carriage to get started'
          }
        </Text>
      </View>
    );
  };

  const renderEditModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showEditModal}
      onRequestClose={() => !savingEdit && setShowEditModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Carriage</Text>
            <TouchableOpacity onPress={() => !savingEdit && setShowEditModal(false)} disabled={savingEdit}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Plate Number</Text>
              <TextInput style={[styles.input, { backgroundColor: '#f5f5f5' }]} value={editingCarriage?.plate_number || ''} editable={false} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Capacity *</Text>
              <View style={styles.capacityContainer}>
                <TouchableOpacity 
                  style={styles.capacityButton}
                  onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.max(1, (parseInt(prev.capacity) || 4) - 1)) }))}
                  disabled={savingEdit}
                >
                  <Ionicons name="remove" size={20} color="#666" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.capacityInput, formErrors.capacity && styles.inputError]}
                  value={editForm.capacity}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, capacity: text }))}
                  keyboardType="numeric"
                  editable={!savingEdit}
                />
                <TouchableOpacity 
                  style={styles.capacityButton}
                  onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.min(10, (parseInt(prev.capacity) || 4) + 1)) }))}
                  disabled={savingEdit}
                >
                  <Ionicons name="add" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              {formErrors.capacity && <Text style={styles.errorText}>{formErrors.capacity}</Text>}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Status *</Text>
              <View style={styles.statusOptions}>
                {['available', 'in_use', 'maintenance', 'out_of_service'].map((status) => {
                  const statusConfig = {
                    available: { icon: 'checkmark-circle', color: '#10B981', bgColor: '#ECFDF5', text: 'Available' },
                    in_use: { icon: 'time', color: '#EF4444', bgColor: '#FEF2F2', text: 'In Use' },
                    maintenance: { icon: 'build', color: '#F59E0B', bgColor: '#FFFBEB', text: 'Maintenance' },
                    out_of_service: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEF2F2', text: 'Out of Service' },
                  };
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        editForm.status === status && styles.statusOptionSelected,
                        { backgroundColor: (statusConfig[status]?.bgColor || '#f5f5f5') }
                      ]}
                      onPress={() => setEditForm(prev => ({ ...prev, status }))}
                      disabled={savingEdit}
                    >
                      <Ionicons name={(statusConfig[status]?.icon || 'help-circle')} size={16} color={(statusConfig[status]?.color || '#666')} style={styles.statusIcon} />
                      <Text style={[styles.statusOptionText, { color: (statusConfig[status]?.color || '#666') }, editForm.status === status && styles.statusOptionTextSelected]}>
                        {status === 'out_of_service' ? 'Out of Service' : (statusConfig[status]?.text || 'Unknown')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formErrors.status && <Text style={styles.errorText}>{formErrors.status}</Text>}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any additional notes about this carriage"
                value={editForm.notes}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, notes: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!savingEdit}
              />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, savingEdit && styles.buttonDisabled]} onPress={() => setShowEditModal(false)} disabled={savingEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton, savingEdit && styles.buttonDisabled]} onPress={handleUpdateCarriage} disabled={savingEdit}>
              {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Main render function
  return (
    <View style={styles.container}>
      <TARTRACKHeader
        title="My Tartanilla Carriages"
        onNotificationPress={() => navigation.navigate('NotificationScreen')} 
      />
      
      <View style={styles.headerContainer}>
        <Text style={styles.heading}>Carriage Management</Text>
        <Text style={styles.subheading}>
          {user?.role === 'driver' ? 'View your assigned carriages' : 'Manage your tartanilla carriages and drivers'}
        </Text>
      </View>
      
      {/* Driver Assignment Modal */}
      {renderDriverModal()}
      
      {(user?.role === 'owner' || user?.role === 'driver-owner') && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MAROON} />
          <Text style={styles.loadingText}>Loading carriages...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.scrollViewContent}
        >
          {carriages.length === 0 ? (
            renderEmptyState()
          ) : (
            carriages.map((carriage) => renderCarriageCard(carriage))
          )}
        </ScrollView>
      )}
      
      {/* Add Carriage Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddModal}
        onRequestClose={() => !addingCarriage && setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Carriage</Text>
              <TouchableOpacity 
                onPress={() => !addingCarriage && setShowAddModal(false)}
                disabled={addingCarriage}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Plate Number *</Text>
                <TextInput
                  style={[styles.input, formErrors.plate_number && styles.inputError]}
                  placeholder="e.g., ABC 123"
                  value={newCarriage.plate_number}
                  onChangeText={(text) => setNewCarriage({...newCarriage, plate_number: text})}
                  editable={!addingCarriage}
                />
                {formErrors.plate_number && (
                  <Text style={styles.errorText}>{formErrors.plate_number}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Capacity *</Text>
                <View style={styles.capacityContainer}>
                  <TouchableOpacity 
                    style={styles.capacityButton}
                    onPress={() => {
                      const newCapacity = Math.max(1, (parseInt(newCarriage.capacity) || 4) - 1);
                      setNewCarriage({...newCarriage, capacity: newCapacity.toString()});
                    }}
                    disabled={addingCarriage}
                  >
                    <Ionicons name="remove" size={20} color="#666" />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={[styles.input, styles.capacityInput]}
                    value={newCarriage.capacity}
                    onChangeText={(text) => setNewCarriage({...newCarriage, capacity: text})}
                    keyboardType="numeric"
                    editable={!addingCarriage}
                  />
                  
                  <TouchableOpacity 
                    style={styles.capacityButton}
                    onPress={() => {
                      const newCapacity = Math.min(10, (parseInt(newCarriage.capacity) || 4) + 1);
                      setNewCarriage({...newCarriage, capacity: newCapacity.toString()});
                    }}
                    disabled={addingCarriage}
                  >
                    <Ionicons name="add" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                {formErrors.capacity && (
                  <Text style={styles.errorText}>{formErrors.capacity}</Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any additional notes about this carriage"
                  value={newCarriage.notes}
                  onChangeText={(text) => setNewCarriage({...newCarriage, notes: text})}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!addingCarriage}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.imageLabelContainer}>
                  <Text style={styles.label}>Carriage Photos (Optional)</Text>
                  <Text style={styles.imageCountText}>
                    {selectedImages.length}/5 photos
                  </Text>
                </View>
                
                {selectedImages.length > 0 && (
                  <View style={styles.imagesGrid}>
                    {selectedImages.map((image, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                          disabled={addingCarriage || uploadingImage}
                        >
                          <Ionicons name="close-circle" size={20} color="#dc3545" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {selectedImages.length < 5 && (
                  <View style={styles.imageUploadContainer}>
                    <TouchableOpacity 
                      style={styles.imageUploadButton}
                      onPress={() => {
                        Alert.alert(
                          'Select Images',
                          'Choose how you want to add photos',
                          [
                            { text: 'Camera', onPress: takePhoto },
                            { text: 'Gallery', onPress: pickImage },
                            { text: 'Cancel', style: 'cancel' }
                          ]
                        );
                      }}
                      disabled={addingCarriage || uploadingImage}
                    >
                      <Ionicons name="camera-outline" size={32} color="#6c757d" />
                      <Text style={styles.imageUploadText}>
                        Add {selectedImages.length === 0 ? 'Photos' : 'More Photos'}
                      </Text>
                      <Text style={styles.imageUploadSubtext}>
                        {5 - selectedImages.length} more photos allowed
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedImages.length > 0 && (
                  <TouchableOpacity 
                    style={styles.clearAllButton}
                    onPress={clearAllImages}
                    disabled={addingCarriage || uploadingImage}
                  >
                    <Ionicons name="trash-outline" size={16} color="#dc3545" />
                    <Text style={styles.clearAllButtonText}>Clear All Photos</Text>
                  </TouchableOpacity>
                )}

                {uploadingImage && (
                  <View style={styles.uploadingContainer}>
                    <ActivityIndicator size="small" color={MAROON} />
                    <Text style={styles.uploadingText}>Uploading images...</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton, addingCarriage && styles.buttonDisabled]}
                onPress={() => !addingCarriage && setShowAddModal(false)}
                disabled={addingCarriage}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.saveButton, addingCarriage && styles.buttonDisabled]}
                onPress={handleAddCarriage}
                disabled={addingCarriage}
              >
                {addingCarriage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Carriage</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Carriage Modal */}
      {renderEditModal()}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: MAROON,
    marginBottom: 4,
  },
  waiting_driver_acceptance: {
    icon: 'hourglass-outline',
    color: '#ff8f00',
    bgColor: '#FFF3E0',
    text: 'Pending Driver',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MAROON,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  // Modern Card Styles
  carriageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fafbfc',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  plateSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  plateNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: MAROON,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardBody: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    marginRight: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  alertText: {
    fontSize: 13,
    color: '#92400e',
    marginLeft: 8,
    fontWeight: '500',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  actionButtons: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MAROON,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: MAROON,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: MAROON,
  },
  modalBody: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc3545',
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  capacityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  capacityInput: {
    flex: 1,
    textAlign: 'center',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusOptionSelected: {
    borderColor: MAROON,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusOptionTextSelected: {
    fontWeight: '600',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  saveButton: {
    backgroundColor: MAROON,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Driver Modal Styles
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  driverItemDisabled: {
    opacity: 0.6,
  },
  driverAvatar: {
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  driverEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  driverPhone: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  driverRole: {
    fontSize: 12,
    color: '#495057',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  selectDriverButton: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginHorizontal: 16,
  },
  // Image Upload Styles
  imageLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageCountText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  imageUploadContainer: {
    marginTop: 8,
  },
  imageUploadButton: {
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  imageUploadText: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 8,
    fontWeight: '500',
  },
  imageUploadSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '48%',
    aspectRatio: 1,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 2,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  clearAllButtonText: {
    fontSize: 12,
    color: '#dc3545',
    marginLeft: 4,
    fontWeight: '500',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  uploadingText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
});
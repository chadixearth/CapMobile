import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Dimensions, Image, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
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

  const [loading, setLoading] = useState(true);
  
  // Debug render - only in development
  if (__DEV__) {
    console.log('RENDER DEBUG - Loading:', loading, 'Auth loading:', auth.loading, 'Authenticated:', auth.isAuthenticated);
  }
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
  const fetchAllDrivers = async (retryCount = 0) => {
    try {
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.min(2000 * Math.pow(2, retryCount), 8000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const drivers = await driverService.getAllDrivers();
      console.log('Fetched drivers:', drivers);
      const list = Array.isArray(drivers) ? drivers : [];
      console.log('Driver list:', list);
      setAvailableDrivers(list);
      
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
      
      // Retry on 429 errors up to 3 times
      if (error.message?.includes('429') && retryCount < 3) {
        console.log(`Rate limited, retrying in ${Math.min(2000 * Math.pow(2, retryCount + 1), 8000)}ms...`);
        return fetchAllDrivers(retryCount + 1);
      }
      
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
    setAvailableDrivers([]);
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
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
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

      return {
        url: publicUrl,
        filename,
        storage_path: filename,
      };
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
      
      const uploaded = await Promise.all(uploadPromises);
      return uploaded;
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
        
        // Debug TETS carriage specifically
        const testsCarriage = carriageData.find(c => c.plate_number === 'TETS');
        if (testsCarriage) {
          console.log('TETS carriage details:', testsCarriage);
        }
        
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
      // Use setTimeout to ensure navigation is ready
      const timer = setTimeout(() => {
        if (navigation?.isReady?.()) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          });
        }
      }, 100);
      return () => clearTimeout(timer);
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
        // Get all unique assigned driver IDs from carriages
        const allAssignedIds = [...new Set((carriages || [])
          .filter(c => c.assigned_driver_id)
          .map(c => c.assigned_driver_id))];

        if (allAssignedIds.length === 0) return;

        // Check which drivers need real data (not just placeholders)
        const needsRealData = allAssignedIds.filter(id => {
          const cached = driverCache[id] || driverCache[String(id)];
          return !cached || cached.email === 'Unknown Driver';
        });

        console.log('All assigned driver IDs:', allAssignedIds);
        console.log('Drivers needing real data:', needsRealData);
        console.log('Current cache keys:', Object.keys(driverCache));
        
        // Fetch real driver data
        if (needsRealData.length > 0) {
          try {
            const allDrivers = await driverService.getAllDrivers();
            const updates = {};
            
            for (const id of needsRealData) {
              // Find driver in available drivers list
              const driver = allDrivers.find(d => 
                String(d.id) === String(id) || String(d.user_id) === String(id)
              );
              
              if (driver) {
                updates[String(id)] = driver;
                updates[id] = driver;
                console.log('✓ Found driver:', id, driver.email || driver.name);
              } else {
                // Create placeholder if not found
                const driverObj = {
                  id: id,
                  email: 'Unknown Driver',
                  name: 'Unknown Driver'
                };
                updates[String(id)] = driverObj;
                updates[id] = driverObj;
                console.log('✓ Created placeholder for:', id);
              }
            }
            
            if (Object.keys(updates).length > 0) {
              setDriverCache(prev => ({ ...prev, ...updates }));
            }
          } catch (e) {
            console.log('✗ Failed to fetch drivers:', e.message);
          }
        }
      } catch (e) {
        console.error('Error in fetchMissingDrivers:', e);
      }
    };
    
    if (carriages.length > 0) {
      fetchMissingDrivers();
    }
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

    // Require at least one image
    if (!selectedImages || selectedImages.length === 0) {
      errors.images = 'At least one photo is required';
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
      let uploadedImages = [];
      
      // Upload images if selected
      if (selectedImages.length > 0) {
        try {
          uploadedImages = await uploadAllImages(selectedImages);
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
        image_urls: uploadedImages.map(i => i.url),
        // Store structured photos array compatible with Django TourPackages
        img: uploadedImages.length ? uploadedImages.map(i => ({
          url: i.url,
          caption: '',
          filename: i.filename,
          uploaded_at: new Date().toISOString(),
          storage_path: i.storage_path,
        })) : null
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
      console.log('[CarriageCreate] Response:', JSON.stringify(result, null, 2));
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add carriage');
      }

      // Fallbacks: if backend ignored img during create, patch it right after
      try {
        let newId = result?.data?.id || result?.data?.carriage?.id;
        const hasImgInResponse = !!(result?.data?.img);

        if (!newId) {
          // Resolve the newly created carriage by plate_number
          try {
            const ownerResult = await getMyCarriages();
            if (ownerResult.success && Array.isArray(ownerResult.data)) {
              const match = ownerResult.data.find(c =>
                (c.plate_number || '').toLowerCase() === carriageData.plate_number.toLowerCase()
              );
              if (match?.id) newId = match.id;
            }
          } catch (e) {
            console.log('[CarriageCreate] Could not resolve new carriage by plate_number:', e?.message);
          }
        }

        if (newId && uploadedImages.length && !hasImgInResponse) {
          const photos = uploadedImages.map(i => ({
            url: i.url,
            caption: '',
            filename: i.filename,
            uploaded_at: new Date().toISOString(),
            storage_path: i.storage_path,
          }));
          console.log('[CarriageCreate] Patching IMG for carriage:', newId);
          try {
            await carriageService.updateCarriage(newId, { img: photos });
          } catch (apiErr) {
            // If API rejects PATCH (e.g., 405), write directly via Supabase as a fallback
            console.log('[CarriageCreate] API PATCH failed, falling back to Supabase update');
            const { error: supaErr } = await supabase
              .from('tartanilla_carriages')
              .update({ img: photos, updated_at: new Date().toISOString() })
              .eq('id', newId);
            if (supaErr) {
              console.log('[CarriageCreate] Supabase update failed:', supaErr.message);
            }
          }
        }
      } catch (e) {
        console.log('[CarriageCreate] IMG patch failed:', e?.message);
        // Non-blocking: continue UX even if img patch fails
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
              if (navigation?.isReady?.()) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Welcome' }],
                });
              }
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
      status: ['maintenance', 'out_of_service'].includes(carriage.status) ? carriage.status : '',
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

      // Update carriage status
      await carriageService.updateCarriage(editingCarriage.id, updates);

      // If status is set to maintenance, also update the assigned driver's status
      if (editForm.status === 'maintenance' && editingCarriage.assigned_driver_id) {
        try {
          // Update driver status to maintenance as well
          const { apiClient } = await import('../../services/improvedApiClient');
          await apiClient.patch(`/accounts/api/users/${editingCarriage.assigned_driver_id}/`, {
            carriage_status: 'maintenance'
          });
        } catch (driverUpdateError) {
          console.warn('Failed to update driver status:', driverUpdateError);
          // Don't fail the whole operation if driver update fails
        }
      }

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

  // Helper function to get carriage image (similar to OwnerHomeScreen)
  const getCarriageImage = (carriage) => {
    const pickFirstUrl = (val) => {
      if (!val) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if ((trimmed.startsWith('[') || trimmed.startsWith('{'))) {
          try { return pickFirstUrl(JSON.parse(trimmed)); } catch (_) { /* fallthrough */ }
        }
        return val;
      }
      if (Array.isArray(val)) {
        for (const v of val) {
          if (typeof v === 'string' && v) return v;
          if (v && typeof v === 'object' && typeof v.url === 'string') return v.url;
        }
        return null;
      }
      if (typeof val === 'object') {
        if (Array.isArray(val.urls)) return pickFirstUrl(val.urls);
        if (typeof val.url === 'string') return val.url;
      }
      return null;
    };

    try {
      let url = null;
      const iu = carriage?.image_urls;
      if (typeof iu === 'string') {
        try { url = pickFirstUrl(JSON.parse(iu)); } catch (_) { url = pickFirstUrl(iu); }
      } else {
        url = pickFirstUrl(iu);
      }
      url = url || pickFirstUrl(carriage?.img);
      url = url || pickFirstUrl(carriage?.images);
      url = url || pickFirstUrl(carriage?.photos);
      url = url || pickFirstUrl(carriage?.photo_url);
      url = url || pickFirstUrl(carriage?.image_url);
      if (url) return { uri: url };
    } catch (_) {
      // ignore and fall back
    }
    return require('../../../assets/tartanilla.jpg');
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
    const cached = driverCache[carriage.assigned_driver_id] || driverCache[String(carriage.assigned_driver_id)];

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

    console.log('Carriage driver info:', {
      carriage_id: carriage.id,
      assigned_driver_id: carriage.assigned_driver_id,
      assigned_driver: carriage.assigned_driver,
      cached: cached
    });
    const driverName = buildName(carriage.assigned_driver) || buildName(cached) || (carriage.assigned_driver_id ? 'Unknown Driver' : 'No driver assigned');
    const driverEmail = carriage.assigned_driver?.email || cached?.email || '';
    const driverPhone = carriage.assigned_driver?.phone || carriage.assigned_driver?.mobile || carriage.assigned_driver?.phone_number || cached?.phone || cached?.mobile || cached?.phone_number || '';
    const hasDriverSelected = !!(carriage.assigned_driver_id || carriage.assigned_driver);
    const assignmentStatus = hasDriverSelected && carriage.status === 'waiting_driver_acceptance' ? 'Waiting for driver acceptance' : null;

    return (
      <View key={carriage.id} style={styles.tartanillaRow}>
        <Image source={getCarriageImage(carriage)} style={styles.tartanillaImg} />
        <View style={styles.tartanillaInfo}>
          <Text style={styles.tcPlate}>{carriage.plate_number}</Text>

          {/* Capacity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="people-outline" size={16} color="#444" />
            <Text style={styles.tcDriver} numberOfLines={1}> {carriage.capacity || 'N/A'} passengers</Text>
          </View>

          {/* Driver with people icon */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="person-outline" size={16} color="#444" />
            <Text style={styles.tcDriver} numberOfLines={1}> {driverName}</Text>
          </View>

          {/* Status Badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <Ionicons name={status.icon} size={12} color={status.color} />
              <Text style={[styles.statusText, { color: status.color, fontSize: 10 }]}>{status.text}</Text>
            </View>
            {/* Eligibility Indicator */}
            <View style={[styles.statusBadge, { backgroundColor: carriage.eligibility === 'eligible' ? '#ECFDF5' : '#FEF2F2' }]}>
              <Ionicons 
                name={carriage.eligibility === 'eligible' ? 'shield-checkmark' : 'shield-outline'} 
                size={12} 
                color={carriage.eligibility === 'eligible' ? '#10B981' : '#EF4444'} 
              />
              <Text style={[styles.statusText, { 
                color: carriage.eligibility === 'eligible' ? '#10B981' : '#EF4444', 
                fontSize: 10 
              }]}>
                {carriage.eligibility === 'eligible' ? 'Eligible' : 'Not Eligible'}
              </Text>
            </View>
          </View>

          {assignmentStatus && (
            <View style={styles.alertBox}>
              <Ionicons name="information-circle-outline" size={14} color="#F59E0B" />
              <Text style={[styles.alertText, { fontSize: 11 }]}>{assignmentStatus}</Text>
            </View>
          )}

          <View style={{ alignItems: 'flex-end' }}>
            <TouchableOpacity style={styles.seeBtn} onPress={() => openSheet(carriage)}>
              <Text style={styles.seeBtnText}>See Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isDriver && (
          <View style={styles.actionButtonsContainer}>
            {!hasDriverSelected && (
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => openDriverModal(carriage)}
                disabled={assigningDriver}
              >
                <Ionicons name="person-add-outline" size={16} color={MAROON} />
              </TouchableOpacity>
            )}
            {hasDriverSelected && carriage.status === 'waiting_driver_acceptance' && (
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => openDriverModal(carriage)}
                disabled={assigningDriver}
              >
                <Ionicons name="sync-outline" size={16} color={MAROON} />
              </TouchableOpacity>
            )}
            {hasDriverSelected && carriage.status !== 'waiting_driver_acceptance' && (
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => openDriverModal(carriage)}
                disabled={assigningDriver}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={MAROON} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openEditModal(carriage)}
              disabled={savingEdit}
            >
              <Ionicons name="create-outline" size={16} color={MAROON} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Add bottom sheet modal for details (similar to OwnerHomeScreen)
  const openSheet = (item) => {
    setSelected(item);
    setVisible(true);
  };

  const closeSheet = () => {
    setVisible(false);
    setSelected(null);
  };

  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(false);

  // Helper functions for status styling (matching OwnerHomeScreen)
  const getStatusStyle = (status) => {
    const statusStyles = {
      available: { backgroundColor: '#ECFDF5' },
      in_use: { backgroundColor: '#FEF2F2' },
      maintenance: { backgroundColor: '#FFFBEB' },
      waiting_driver_acceptance: { backgroundColor: '#FFFBEB' },
      driver_assigned: { backgroundColor: '#EFF6FF' },
      not_usable: { backgroundColor: '#FEF2F2' },
      suspended: { backgroundColor: '#FFFBEB' },
      out_of_service: { backgroundColor: '#FEF2F2' },
    };
    return statusStyles[status?.toLowerCase()] || { backgroundColor: '#F9FAFB' };
  };

  const getStatusColor = (status) => {
    const statusColors = {
      available: '#10B981',
      in_use: '#EF4444',
      maintenance: '#F59E0B',
      waiting_driver_acceptance: '#F59E0B',
      driver_assigned: '#3B82F6',
      not_usable: '#EF4444',
      suspended: '#F59E0B',
      out_of_service: '#EF4444',
    };
    return statusColors[status?.toLowerCase()] || '#6B7280';
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      available: 'checkmark-circle',
      in_use: 'time',
      maintenance: 'build',
      waiting_driver_acceptance: 'hourglass-outline',
      driver_assigned: 'person-circle',
      not_usable: 'close-circle',
      suspended: 'pause-circle',
      out_of_service: 'close-circle',
    };
    return statusIcons[status?.toLowerCase()] || 'help-circle';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      available: 'Available',
      in_use: 'In Use',
      maintenance: 'Maintenance',
      waiting_driver_acceptance: 'Pending Driver',
      driver_assigned: 'Driver Assigned',
      not_usable: 'Not Usable',
      suspended: 'Suspended',
      out_of_service: 'Out of Service',
    };
    return statusTexts[status?.toLowerCase()] || 'Unknown';
  };

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

  const renderDetailsModal = () => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={styles.detailsModalOverlay}>
        <TouchableOpacity style={styles.detailsBackdrop} activeOpacity={1} onPress={closeSheet} />
        <View style={styles.detailsSheet}>
          {selected && (
            <>
              <View style={styles.detailsHandle} />
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                {/* Hero Section */}
                <View style={styles.detailsHeroSection}>
                  <Image source={getCarriageImage(selected)} style={styles.detailsHeroImage} />
                  <View style={styles.detailsHeroOverlay}>
                    <Text style={styles.detailsHeroCode}>{selected.plate_number || `TC${String(selected.id).slice(-4)}`}</Text>
                    {selected.status && (
                      <View style={[styles.detailsHeroStatusBadge, getStatusStyle(selected.status)]}>
                        <Ionicons name={getStatusIcon(selected.status)} size={14} color={getStatusColor(selected.status)} />
                        <Text style={[styles.detailsHeroStatusText, { color: getStatusColor(selected.status) }]}>
                          {getStatusText(selected.status)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Quick Stats */}
                <View style={styles.detailsQuickStats}>
                  <View style={styles.detailsStatCard}>
                    <Ionicons name="people" size={20} color={MAROON} />
                    <Text style={styles.detailsStatNumber}>{selected.capacity || 'N/A'}</Text>
                    <Text style={styles.detailsStatLabel}>Capacity</Text>
                  </View>
                  <View style={styles.detailsStatCard}>
                    <Ionicons name="car" size={20} color={MAROON} />
                    <Text style={styles.detailsStatNumber}>{selected.plate_number ? '✓' : '✗'}</Text>
                    <Text style={styles.detailsStatLabel}>Plate</Text>
                  </View>
                  <View style={styles.detailsStatCard}>
                    <Ionicons name="person" size={20} color={MAROON} />
                    <Text style={styles.detailsStatNumber}>{buildName(selected.assigned_driver) || buildName(driverCache[selected.assigned_driver_id]) ? '✓' : '✗'}</Text>
                    <Text style={styles.detailsStatLabel}>Driver</Text>
                  </View>
                </View>

                {/* Details Cards */}
                <View style={styles.detailsContainer}>
                  {/* Vehicle Info Card */}
                  <View style={styles.detailsInfoCard}>
                    <View style={styles.detailsCardHeader}>
                      <MaterialCommunityIcons name="horse-variant" size={20} color={MAROON} />
                      <Text style={styles.detailsCardTitle}>Vehicle Information</Text>
                    </View>
                    <View style={styles.detailsCardContent}>
                      <View style={styles.detailsInfoRow}>
                        <Text style={styles.detailsInfoLabel}>Plate Number</Text>
                        <Text style={styles.detailsInfoValue}>{selected.plate_number || 'Not assigned'}</Text>
                      </View>
                      <View style={styles.detailsInfoRow}>
                        <Text style={styles.detailsInfoLabel}>Passenger Capacity</Text>
                        <Text style={styles.detailsInfoValue}>{selected.capacity || 'N/A'} passengers</Text>
                      </View>
                    </View>
                  </View>

                  {/* Driver Info Card */}
                  <View style={styles.detailsInfoCard}>
                    <View style={styles.detailsCardHeader}>
                      <Ionicons name="person-outline" size={20} color={MAROON} />
                      <Text style={styles.detailsCardTitle}>Driver Information</Text>
                    </View>
                    <View style={styles.detailsCardContent}>
                      {buildName(selected.assigned_driver) || buildName(driverCache[selected.assigned_driver_id]) ? (
                        <>
                          <View style={styles.detailsDriverProfile}>
                            <View style={styles.detailsDriverAvatar}>
                              <Ionicons name="person" size={24} color={MAROON} />
                            </View>
                            <View style={styles.detailsDriverInfo}>
                              <Text style={styles.detailsDriverName}>{buildName(selected.assigned_driver) || buildName(driverCache[selected.assigned_driver_id])}</Text>
                              {(selected.assigned_driver?.email || driverCache[selected.assigned_driver_id]?.email) && (
                                <Text style={styles.detailsDriverContact}>✉️ {selected.assigned_driver?.email || driverCache[selected.assigned_driver_id]?.email}</Text>
                              )}
                              {(selected.assigned_driver?.phone || driverCache[selected.assigned_driver_id]?.phone) && (
                                <Text style={styles.detailsDriverContact}>📱 {selected.assigned_driver?.phone || driverCache[selected.assigned_driver_id]?.phone}</Text>
                              )}
                            </View>
                          </View>
                        </>
                      ) : (
                        <View style={styles.detailsNoDriverState}>
                          <Ionicons name="person-add-outline" size={32} color="#ccc" />
                          <Text style={styles.detailsNoDriverText}>No driver assigned</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Notes Card (if exists) */}
                  {selected.notes && (
                    <View style={styles.detailsInfoCard}>
                      <View style={styles.detailsCardHeader}>
                        <Ionicons name="document-text-outline" size={20} color={MAROON} />
                        <Text style={styles.detailsCardTitle}>Notes</Text>
                      </View>
                      <View style={styles.detailsCardContent}>
                        <Text style={styles.detailsNotesText}>{selected.notes}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={styles.detailsCloseBtn} onPress={closeSheet}>
                  <Ionicons name="close" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.detailsCloseText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

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
                      {(() => {
                        console.log('Driver object keys:', Object.keys(item));
                        console.log('Driver object:', item);
                        const profileUrl = item.profile_photo_url || item.profile_image;
                        console.log('Profile URL found:', profileUrl);
                        return profileUrl ? (
                          <Image 
                            source={{ uri: profileUrl }} 
                            style={styles.driverProfileImage}
                            onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                          />
                        ) : (
                          <Ionicons name="person-circle-outline" size={40} color={MAROON} />
                        );
                      })()}
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
        <MaterialCommunityIcons name="horse-variant" size={48} color="#ccc" />
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
      <View style={styles.editModalOverlay}>
        <View style={styles.editModalContent}>
          {/* Header */}
          <View style={styles.editModalHeader}>
            <View style={styles.editModalTitleContainer}>
              <View style={styles.editModalIconContainer}>
                <Ionicons name="create-outline" size={20} color={MAROON} />
              </View>
              <Text style={styles.editModalTitle}>Edit Carriage</Text>
            </View>
            <TouchableOpacity 
              style={styles.editModalCloseButton}
              onPress={() => !savingEdit && setShowEditModal(false)} 
              disabled={savingEdit}
            >
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false}>
            {/* Plate Number - Read Only */}
            <View style={styles.editFormSection}>
              <Text style={styles.editLabel}>Plate Number</Text>
              <View style={styles.editReadOnlyContainer}>
                <MaterialCommunityIcons name="horse-variant" size={16} color="#9CA3AF" />
                <Text style={styles.editReadOnlyText}>{editingCarriage?.plate_number || 'N/A'}</Text>
              </View>
            </View>

            {/* Capacity */}
            <View style={styles.editFormSection}>
              <Text style={styles.editLabel}>Passenger Capacity</Text>
              <View style={styles.editCapacityContainer}>
                <TouchableOpacity 
                  style={[styles.editCapacityButton, savingEdit && styles.editButtonDisabled]}
                  onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.max(1, (parseInt(prev.capacity) || 4) - 1)) }))}
                  disabled={savingEdit}
                >
                  <Ionicons name="remove" size={18} color={MAROON} />
                </TouchableOpacity>
                <View style={styles.editCapacityDisplay}>
                  <Text style={styles.editCapacityNumber}>{editForm.capacity}</Text>
                  <Text style={styles.editCapacityLabel}>passengers</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.editCapacityButton, savingEdit && styles.editButtonDisabled]}
                  onPress={() => setEditForm(prev => ({ ...prev, capacity: String(Math.min(10, (parseInt(prev.capacity) || 4) + 1)) }))}
                  disabled={savingEdit}
                >
                  <Ionicons name="add" size={18} color={MAROON} />
                </TouchableOpacity>
              </View>
              {formErrors.capacity && <Text style={styles.editErrorText}>{formErrors.capacity}</Text>}
            </View>

            {/* Status */}
            <View style={styles.editFormSection}>
              <Text style={styles.editLabel}>Status</Text>
              <View style={styles.editStatusGrid}>
                {['available', 'maintenance', 'out_of_service'].map((status) => {
                  const statusConfig = {
                    available: { icon: 'checkmark-circle', color: '#10B981', text: 'Available' },
                    maintenance: { icon: 'build', color: '#F59E0B', text: 'Maintenance' },
                    out_of_service: { icon: 'close-circle', color: '#EF4444', text: 'Out of Service' },
                  };
                  const isSelected = editForm.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.editStatusCard,
                        isSelected && styles.editStatusCardSelected,
                        savingEdit && styles.editButtonDisabled
                      ]}
                      onPress={() => setEditForm(prev => ({ ...prev, status }))}
                      disabled={savingEdit}
                    >
                      <Ionicons 
                        name={statusConfig[status]?.icon || 'help-circle'} 
                        size={20} 
                        color={isSelected ? '#fff' : (statusConfig[status]?.color || '#666')} 
                      />
                      <Text style={[
                        styles.editStatusText,
                        { color: isSelected ? '#fff' : (statusConfig[status]?.color || '#666') }
                      ]}>
                        {statusConfig[status]?.text || 'Unknown'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formErrors.status && <Text style={styles.editErrorText}>{formErrors.status}</Text>}
            </View>

            {/* Notes */}
            <View style={styles.editFormSection}>
              <Text style={styles.editLabel}>Notes</Text>
              <View style={styles.editNotesContainer}>
                <TextInput
                  style={[styles.editNotesInput, savingEdit && styles.editInputDisabled]}
                  placeholder="Add any notes about this carriage..."
                  placeholderTextColor="#9CA3AF"
                  value={editForm.notes}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, notes: text }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!savingEdit}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.editModalFooter}>
            <TouchableOpacity 
              style={[styles.editCancelButton, savingEdit && styles.editButtonDisabled]} 
              onPress={() => setShowEditModal(false)} 
              disabled={savingEdit}
            >
              <Text style={styles.editCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.editSaveButton, savingEdit && styles.editButtonDisabled]} 
              onPress={handleUpdateCarriage} 
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.editSaveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Main render function
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.hero}>
        <TARTRACKHeader
          onMessagePress={() => navigation.navigate('Chat')}
          onNotificationPress={() => navigation.navigate('Notification')}
        />
      </View>

      {/* Floating title card */}
      <View style={styles.titleCard}>
        <View style={styles.titleCenter}>
          <MaterialCommunityIcons name="horse-variant" size={24} color="#6B2E2B" />
          <Text style={styles.titleText}>My Carriages</Text>
        </View>
        {(user?.role === 'owner' || user?.role === 'driver-owner') && (
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={styles.addButtonHeader}
          >
            <Ionicons name="add" size={20} color="#6B2E2B" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Driver Assignment Modal */}
      {renderDriverModal()}
      

      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MAROON} />
          <Text style={styles.loadingText}>Loading carriages...</Text>
        </View>
      ) : (
        <FlatList
          data={carriages}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderCarriageCard(item)}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          numColumns={user?.role === 'driver' ? 1 : 1}
        />
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
                  <Text style={styles.label}>Carriage Photos (Required)</Text>
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

                {formErrors.images && (
                  <Text style={styles.errorText}>{formErrors.images}</Text>
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
      
      {/* Details Modal */}
      {renderDetailsModal()}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  hero: {
    backgroundColor: MAROON,
    paddingTop: 6,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  titleCard: {
    marginHorizontal: 16,
    marginTop: -12,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EFE7E4',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  titleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  addButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCD8',
  },
  content: {
    padding: 16,
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
  // Tartanilla card styles (matching OwnerHomeScreen design)
  tartanillaRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 120,
    position: 'relative',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  tartanillaImg: {
    width: 120,
    height: '100%',
    resizeMode: 'cover',
  },
  tartanillaInfo: {
    flex: 1,
    padding: 12,
    backgroundColor: '#e4e4e4ff',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  tcPlate: {
    color: '#fff',
    backgroundColor: MAROON,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
    fontSize: 14,
  },
  tcDriver: { 
    color: '#2C2C2C', 
    fontSize: 12 
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#F59E0B',
  },
  alertText: {
    fontSize: 11,
    color: '#92400e',
    marginLeft: 6,
    fontWeight: '500',
  },
  seeBtn: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  seeBtnText: { 
    color: '#3D3D3D', 
    fontWeight: '600', 
    fontSize: 12 
  },
  actionButtonsContainer: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'column',
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  driverProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  
  // Details Modal Styles (matching OwnerHomeScreen)
  detailsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  detailsBackdrop: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  detailsSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '15%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  detailsHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  detailsHeroSection: {
    position: 'relative',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailsHeroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  detailsHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsHeroCode: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  detailsHeroStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailsHeroStatusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  detailsQuickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  detailsStatCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  detailsStatNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1F1F',
    marginTop: 8,
  },
  detailsStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  detailsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  detailsInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  detailsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
    marginLeft: 8,
  },
  detailsCardContent: {
    padding: 16,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  detailsInfoLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  detailsInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    flex: 1,
    textAlign: 'right',
  },
  detailsDriverProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsDriverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailsDriverInfo: {
    flex: 1,
  },
  detailsDriverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  detailsDriverContact: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailsNoDriverState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  detailsNoDriverText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  detailsNotesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  detailsCloseBtn: {
    backgroundColor: MAROON,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  detailsCloseText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Modern Edit Modal Styles
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.92,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editModalIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  editModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalBody: {
    paddingHorizontal: 24,
    maxHeight: 400,
  },
  editFormSection: {
    marginBottom: 24,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  editReadOnlyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editReadOnlyText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 10,
    fontWeight: '500',
  },
  editCapacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 8,
  },
  editCapacityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editCapacityDisplay: {
    alignItems: 'center',
    marginHorizontal: 32,
  },
  editCapacityNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: MAROON,
  },
  editCapacityLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  editStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  editStatusCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  editStatusCardSelected: {
    backgroundColor: MAROON,
    borderColor: MAROON,
  },
  editStatusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  editNotesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editNotesInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#374151',
    minHeight: 80,
  },
  editInputDisabled: {
    opacity: 0.6,
  },
  editButtonDisabled: {
    opacity: 0.5,
  },
  editErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    marginLeft: 4,
  },
  editModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  editSaveButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MAROON,
    gap: 8,
  },
  editSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
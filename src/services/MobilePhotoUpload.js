import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform, Linking } from 'react-native';

/**
 * MobilePhotoUpload - A unified service for handling photo uploads across different user types
 */
export default class MobilePhotoUpload {
  constructor(baseUrl = 'http://192.168.1.8:8000/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Pick an image from camera or gallery
   * @returns {Promise<Object|null>} Selected image object or null if cancelled
   */
  async pickImage() {
    try {
      // Check platform support
      if (Platform.OS === 'web') {
        Alert.alert('Not supported', 'Photo upload is only supported on mobile devices.');
        return null;
      }

      // Show options for camera or gallery
      return new Promise((resolve) => {
        Alert.alert(
          'Select Photo',
          'Choose how you want to select your photo',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            { 
              text: 'Take Photo', 
              onPress: async () => {
                const result = await this._handleCameraLaunch();
                resolve(result);
              }
            },
            { 
              text: 'Choose from Gallery', 
              onPress: async () => {
                const result = await this._handleGalleryLaunch();
                resolve(result);
              }
            }
          ]
        );
      });

    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open photo selection options.');
      return null;
    }
  }

  /**
   * Pick multiple images from gallery
   * @param {number} maxImages - Maximum number of images to select
   * @returns {Promise<Array|null>} Array of selected images or null if cancelled
   */
  async pickMultipleImages(maxImages = 5) {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Not supported', 'Multiple photo upload is only supported on mobile devices.');
        return null;
      }

      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Gallery Permission Required', 
          'We need access to your photo library to upload photos. Please enable this permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') }
          ]
        );
        return null;
      }

      // Launch image picker for multiple selection
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxImages,
        base64: false,
      });

      return await this._handleImageResult(pickerResult, true);

    } catch (error) {
      console.error('Multiple image picker error:', error);
      Alert.alert('Error', 'Failed to open photo gallery. Please try again.');
      return null;
    }
  }

  /**
   * Upload profile photo for any user type (Tourist, Driver, Owner)
   * @param {string} userId - The user ID
   * @param {string} imageUri - The image URI to upload
   * @returns {Promise<Object>} Upload result
   */
  async uploadProfilePhoto(userId, imageUri) {
    try {
      console.log('MobilePhotoUpload: Uploading profile photo for user:', userId);
      console.log('Image URI:', imageUri.substring(0, 100) + '...');
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add user_id (matching your Django API expectation)
      formData.append('user_id', userId);
      
      // Create a file-like object for React Native
      const imageFile = await this._createFileFromUri(imageUri);
      console.log('Created image file object:', {
        name: imageFile.name,
        type: imageFile.type,
        uri: imageFile.uri.substring(0, 50) + '...'
      });
      
      formData.append('photo', imageFile);

      console.log('Sending request to:', `${this.baseUrl}/upload/profile-photo/`);

      // Create an AbortController for manual timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds for file upload

      const response = await fetch(`${this.baseUrl}/upload/profile-photo/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          // Don't set Content-Type - let FormData set it with boundary
        },
      });

      clearTimeout(timeoutId);
      
      console.log('Upload response status:', response.status);
      console.log('Response headers:', response.headers);
      
      // Try to get response text first to see what the server is returning
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.log('Response is not JSON:', responseText);
        }
        
        throw new Error(
          errorData.message || 
          errorData.error || 
          `HTTP ${response.status}: ${response.statusText}. Response: ${responseText}`
        );
      }
      
      // Parse the successful response
      let result = {};
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.log('Success response is not JSON:', responseText);
        result = { message: responseText };
      }
      
      console.log('Upload success result:', result);
      
      return {
        success: true,
        photo_url: result.photo_url || result.photoUrl || result.url,
        message: result.message || 'Photo uploaded successfully'
      };

    } catch (error) {
      console.error('Profile photo upload error:', error);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Upload timeout - please check your connection and try again'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to upload profile photo'
      };
    }
  }

  // Note: Only using profile photo upload endpoint as requested
  // Other upload methods removed to focus on the single endpoint

  /**
   * Private method to handle camera launch
   */
  async _handleCameraLaunch() {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.status !== 'granted') {
        Alert.alert(
          'Camera Permission Required', 
          'We need access to your camera to take photos. Please enable this permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') }
          ]
        );
        return null;
      }

      // Launch camera
      const pickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      return await this._handleImageResult(pickerResult);

    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
      return null;
    }
  }

  /**
   * Private method to handle gallery launch
   */
  async _handleGalleryLaunch() {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Gallery Permission Required', 
          'We need access to your photo library to upload photos. Please enable this permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') }
          ]
        );
        return null;
      }

      // Launch image picker
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
        selectionLimit: 1,
        base64: false,
      });

      return await this._handleImageResult(pickerResult);

    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open photo gallery. Please try again.');
      return null;
    }
  }

  /**
   * Private method to handle image picker result
   */
  async _handleImageResult(pickerResult, isMultiple = false) {
    try {
      // Handle cancellation
      if (pickerResult.canceled || !pickerResult.assets) {
        console.log('Image selection was cancelled by user');
        return null;
      }

      // Validate selection
      if (pickerResult.assets.length === 0) {
        Alert.alert('Error', 'No image was selected. Please try again.');
        return null;
      }

      if (isMultiple) {
        // Return array of images for multiple selection
        const validatedImages = [];
        
        for (const asset of pickerResult.assets) {
          const validation = this._validateImage(asset);
          if (validation.isValid) {
            validatedImages.push({
              uri: asset.uri,
              width: asset.width,
              height: asset.height,
              fileSize: asset.fileSize
            });
          } else {
            Alert.alert('Invalid Image', validation.error);
          }
        }
        
        return validatedImages.length > 0 ? validatedImages : null;
      } else {
        // Return single image
        const selectedAsset = pickerResult.assets[0];
        const validation = this._validateImage(selectedAsset);
        
        if (!validation.isValid) {
          Alert.alert('Invalid Image', validation.error);
          return null;
        }

        return {
          uri: selectedAsset.uri,
          width: selectedAsset.width,
          height: selectedAsset.height,
          fileSize: selectedAsset.fileSize
        };
      }

    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert('Error', 'Failed to process selected image.');
      return null;
    }
  }

  /**
   * Private method to validate image
   */
  _validateImage(asset) {
    // Validate file size (10MB limit)
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      return {
        isValid: false,
        error: 'Please select an image smaller than 10MB.'
      };
    }

    // Validate image dimensions if needed
    if (asset.width && asset.height) {
      const minDimension = 100;
      if (asset.width < minDimension || asset.height < minDimension) {
        return {
          isValid: false,
          error: `Please select an image at least ${minDimension}x${minDimension} pixels.`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Private method to create a file-like object from URI for React Native
   */
  async _createFileFromUri(uri) {
    const fileExtension = uri.split('.').pop() || 'jpg';
    const fileName = `photo_${Date.now()}.${fileExtension}`;
    
    // For React Native, return an object that FormData can handle
    return {
      uri: uri,
      type: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
      name: fileName,
    };
  }
}

// Example usage of MobilePhotoUpload service for different user types
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import MobilePhotoUpload from '../services/MobilePhotoUpload';

/**
 * Example: Upload profile photo for Tourist users
 */
export const uploadTouristPhoto = async (touristUserId, setProfileImage) => {
  try {
    const photoService = new MobilePhotoUpload();
    
    // Pick image from camera or gallery
    const image = await photoService.pickImage();
    if (!image) return; // User cancelled
    
    console.log('Tourist selected image:', image);
    
    // Upload profile photo
    const result = await photoService.uploadProfilePhoto(touristUserId, image.uri);
    
    if (result.success) {
      console.log('Tourist photo uploaded:', result.photo_url);
      setProfileImage(result.photo_url);
      alert('Profile photo updated successfully!');
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Tourist photo upload error:', error);
    alert('Failed to upload photo. Please try again.');
  }
};

/**
 * Example: Upload profile photo for Driver users
 */
export const uploadDriverPhoto = async (driverUserId, setProfileImage) => {
  try {
    const photoService = new MobilePhotoUpload();
    
    // Pick image from camera or gallery
    const image = await photoService.pickImage();
    if (!image) return; // User cancelled
    
    console.log('Driver selected image:', image);
    
    // Upload profile photo
    const result = await photoService.uploadProfilePhoto(driverUserId, image.uri);
    
    if (result.success) {
      console.log('Driver photo uploaded:', result.photo_url);
      setProfileImage(result.photo_url);
      alert('Profile photo updated successfully!');
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Driver photo upload error:', error);
    alert('Failed to upload photo. Please try again.');
  }
};

/**
 * Example: Upload profile photo for Owner users
 */
export const uploadOwnerPhoto = async (ownerUserId, setProfileImage) => {
  try {
    const photoService = new MobilePhotoUpload();
    
    // Pick image from camera or gallery
    const image = await photoService.pickImage();
    if (!image) return; // User cancelled
    
    console.log('Owner selected image:', image);
    
    // Upload profile photo
    const result = await photoService.uploadProfilePhoto(ownerUserId, image.uri);
    
    if (result.success) {
      console.log('Owner photo uploaded:', result.photo_url);
      setProfileImage(result.photo_url);
      alert('Profile photo updated successfully!');
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Owner photo upload error:', error);
    alert('Failed to upload photo. Please try again.');
  }
};

/**
 * Example: Upload tour package photo
 */
export const uploadTourPackagePhoto = async (packageId, setPackageImage) => {
  try {
    const photoService = new MobilePhotoUpload();
    
    // Pick image from camera or gallery
    const image = await photoService.pickImage();
    if (!image) return; // User cancelled
    
    console.log('Tour package selected image:', image);
    
    // Upload tour package photo
    const result = await photoService.uploadTourPackagePhoto(packageId, image.uri);
    
    if (result.success) {
      console.log('Tour package photo uploaded:', result.photo_url);
      setPackageImage(result.photo_url);
      alert('Tour package photo updated successfully!');
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Tour package photo upload error:', error);
    alert('Failed to upload photo. Please try again.');
  }
};

/**
 * Example: Upload multiple photos for tour package
 */
export const uploadMultipleTourPackagePhotos = async (packageId, setPackageImages) => {
  try {
    const photoService = new MobilePhotoUpload();
    
    // Pick multiple images from gallery
    const images = await photoService.pickMultipleImages(5); // Max 5 images
    if (!images || images.length === 0) return; // User cancelled or no images
    
    console.log('Tour package selected images:', images);
    
    // Extract URIs for upload
    const imageUris = images.map(img => img.uri);
    
    // Upload multiple photos
    const result = await photoService.uploadMultiplePhotos(imageUris, packageId, 'tourpackage');
    
    if (result.success) {
      console.log('Multiple photos uploaded:', result.photo_urls);
      setPackageImages(result.photo_urls);
      alert(`${result.photo_urls.length} photos uploaded successfully!`);
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Multiple photos upload error:', error);
    alert('Failed to upload photos. Please try again.');
  }
};

/**
 * Example: React component usage
 */
export const ExampleProfileScreen = ({ userId, userType }) => {
  const [profileImage, setProfileImage] = useState('');
  
  const handleUploadPhoto = async () => {
    switch (userType) {
      case 'tourist':
        await uploadTouristPhoto(userId, setProfileImage);
        break;
      case 'driver':
        await uploadDriverPhoto(userId, setProfileImage);
        break;
      case 'owner':
        await uploadOwnerPhoto(userId, setProfileImage);
        break;
      default:
        alert('Unknown user type');
    }
  };
  
  return (
    <View style={{ padding: 20 }}>
      <Image 
        source={{ uri: profileImage || 'https://via.placeholder.com/150' }} 
        style={{ width: 150, height: 150, borderRadius: 75 }} 
      />
      <TouchableOpacity 
        onPress={handleUploadPhoto}
        style={{ 
          backgroundColor: '#6B2E2B', 
          padding: 15, 
          borderRadius: 10, 
          marginTop: 20,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>
          Upload Profile Photo
        </Text>
      </TouchableOpacity>
    </View>
  );
};

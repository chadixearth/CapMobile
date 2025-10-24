//GOODS AND SERVICES

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Button from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { listGoodsServicesPosts, getGoodsServicesProfileByAuthor, upsertGoodsServicesProfile, deleteGoodsServicesPost, uploadGoodsServicesMedia } from '../../services/goodsServices';
import { listReviews } from '../../services/reviews';
import { getUserProfile } from '../../services/authService';
import { standardizeUserProfile, getBestAvatarUrl } from '../../utils/profileUtils';
import { apiBaseUrl } from '../../services/networkConfig';
import MobilePhotoUpload from '../../services/MobilePhotoUpload';

const API_BASE_URL = apiBaseUrl();

const { width } = Dimensions.get('window');

export default function GoodsServicesScreen() {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [authorMap, setAuthorMap] = useState({}); // { [author_id]: { name, email } }
  
  // User's own goods & services profile
  const [userProfile, setUserProfile] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Animation refs for loading
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;
  
  const isDriverOrOwner = auth.user?.role === 'driver' || auth.user?.role === 'owner';

  const formatDateTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString(); } catch { return String(d); }
  };
  const getPostedOrUpdated = (item) => {
    const hasUpdate = item?.updated_at && item.updated_at !== item.created_at;
    const ts = hasUpdate ? item.updated_at : item.created_at;
    return `${hasUpdate ? 'Updated' : 'Posted'} ${formatDateTime(ts)}`;
  };

  const fetchUserProfile = useCallback(async () => {
    if (!auth.user?.id || !isDriverOrOwner) return;
    try {
      console.log('[GoodsServicesScreen] Fetching user profile for:', auth.user.id);
      const result = await getGoodsServicesProfileByAuthor(auth.user.id);
      console.log('[GoodsServicesScreen] User profile result:', result);
      
      if (result.success) {
        setUserProfile(result.data);
        setEditDescription(result.data?.description || '');
        // Reset selected images when fetching profile
        setSelectedImages([]);
      } else {
        console.log('[GoodsServicesScreen] No user profile found or error:', result.error);
        setUserProfile(null);
        setEditDescription('');
      }
    } catch (e) {
      console.error('[GoodsServicesScreen] Error fetching user profile:', e);
      setUserProfile(null);
      setEditDescription('');
    }
  }, [auth.user?.id, isDriverOrOwner]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[GoodsServicesScreen] Fetching posts...');
      const result = await listGoodsServicesPosts();
      console.log('[GoodsServicesScreen] Posts result:', result);
      
      if (result.success) {
        const postsData = Array.isArray(result.data) ? result.data : [];
        console.log('[GoodsServicesScreen] Setting posts:', postsData.length, 'items');
        setPosts(postsData);
        setError('');
      } else {
        console.error('[GoodsServicesScreen] Failed to fetch posts:', result.error);
        setError(result.error || 'Failed to load posts');
        setPosts([]);
      }
    } catch (e) {
      console.error('[GoodsServicesScreen] Error fetching posts:', e);
      setError(e.message || 'Failed to load posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      // Fetch all reviews to match with drivers
      const res = await listReviews({ limit: 100, include_stats: true });
      if (res.success) {
        const arr = Array.isArray(res.data) ? res.data : [];
        console.log('Fetched reviews:', arr.length);
        setReviews(arr);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  // Resolve author names and clear cache when posts change
  useEffect(() => {
    const run = async () => {
      try {
        // Clear author map to force refresh
        setAuthorMap({});
        
        const missingIds = Array.from(
          new Set(
            (Array.isArray(posts) ? posts : [])
              .map((p) => p.author_id)
              .filter(Boolean)
          )
        );
        if (missingIds.length === 0) return;

        console.log('Fetching author profiles for:', missingIds.length, 'users');

        const results = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await getUserProfile(id);
              if (res.success && res.data) {
                const userData = res.data;
                const standardizedProfile = standardizeUserProfile(userData);
                
                // Try multiple profile photo fields
                const profilePhotoUrl = userData.profile_photo_url || 
                  userData.profile_photo || 
                  userData.avatar_url ||
                  userData.user_metadata?.profile_photo_url ||
                  userData.user_metadata?.profile_photo;
                
                // Generate fallback avatar if no photo found
                const finalPhotoUrl = profilePhotoUrl || getBestAvatarUrl(userData);
                
                console.log(`Fetched profile for user ${id}:`, {
                  name: userData.name || userData.email,
                  hasPhoto: !!profilePhotoUrl,
                  photoUrl: finalPhotoUrl
                });
                
                return { 
                  id, 
                  ...standardizedProfile,
                  ...userData, // Include all original user data
                  profile_photos: userData.profile_photos || userData.photos || [],
                  profile_photo_url: finalPhotoUrl,
                  avatar_url: finalPhotoUrl
                };
              }
            } catch (error) {
              console.warn('Failed to fetch profile for user:', id, error.message);
            }
            return { id, name: '', email: '', role: 'user', phone: '', profile_photo_url: null };
          })
        );

        const mapUpdate = {};
        for (const r of results) {
          mapUpdate[r.id] = r;
        }
        console.log('Author map updated with:', Object.keys(mapUpdate).length, 'profiles');
        setAuthorMap(mapUpdate);
      } catch (error) {
        console.error('Error resolving author profiles:', error);
      }
    };
    run();
  }, [posts]);

  // Refresh data when screen comes into focus (fixes photo not showing after bio update)
  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      fetchRecentReviews();
      fetchUserProfile();
    }, [fetchPosts, fetchRecentReviews, fetchUserProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear existing data first
      setPosts([]);
      setAuthorMap({});
      setError('');
      
      console.log('[GoodsServicesScreen] Starting refresh...');
      await Promise.all([fetchPosts(), fetchRecentReviews(), fetchUserProfile()]);
      console.log('[GoodsServicesScreen] Refresh completed');
    } catch (error) {
      console.error('[GoodsServicesScreen] Error during refresh:', error);
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [fetchPosts, fetchRecentReviews, fetchUserProfile]);

  // Animation effect for loading
  useEffect(() => {
    if (loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      
      const createDotAnimation = (animValue, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
      };
      
      const dot1Animation = createDotAnimation(dot1Anim, 0);
      const dot2Animation = createDotAnimation(dot2Anim, 200);
      const dot3Animation = createDotAnimation(dot3Anim, 400);
      
      pulse.start();
      dot1Animation.start();
      dot2Animation.start();
      dot3Animation.start();
      
      return () => {
        pulse.stop();
        dot1Animation.stop();
        dot2Animation.stop();
        dot3Animation.stop();
      };
    }
  }, [loading, pulseAnim, dot1Anim, dot2Anim, dot3Anim]);

  const handleSaveProfile = async () => {
    if (!auth.user?.id) return;
    setSaving(true);
    try {
      // Get existing media URLs
      let existingMedia = [];
      if (userProfile?.media && Array.isArray(userProfile.media)) {
        existingMedia = userProfile.media.map(m => 
          typeof m === 'string' ? m : (m?.url || '')
        ).filter(Boolean);
      }
      
      let newMediaUrls = [];
      
      // Upload new images if any selected
      if (selectedImages.length > 0) {
        try {
          const uploadRes = await uploadGoodsServicesMedia(auth.user.id, selectedImages);
          if (!uploadRes.success) {
            Alert.alert('Warning', 'Some images failed to upload, but profile will be saved.');
            return;
          }
          newMediaUrls = uploadRes.urls ? uploadRes.urls.map((url) => ({ url, type: 'image' })) : [];
        } catch {
          Alert.alert('Warning', 'Failed to upload photos. Please try again.');
          return;
        }
      }
      
      // Combine existing and new media
      const allMediaUrls = [...existingMedia, ...newMediaUrls];
      
      const result = await upsertGoodsServicesProfile(auth.user.id, editDescription.trim(), allMediaUrls);
      if (result.success) {
        // Clear cache and force refresh
        setPosts([]);
        setAuthorMap({});
        
        setEditModalVisible(false);
        setSelectedImages([]);
        Alert.alert('Success', 'Your goods & services profile has been updated.');
        
        // Force refresh all data
        await Promise.all([
          fetchPosts(),
          fetchUserProfile(),
          fetchRecentReviews()
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to save profile');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleClearProfile = async () => {
    if (!userProfile?.id) return;
    Alert.alert(
      'Clear Profile',
      'Are you sure you want to remove your goods & services profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const result = await deleteGoodsServicesPost(userProfile.id, auth.user.id);
              if (result.success) {
                // Clear all state
                setUserProfile(null);
                setEditDescription('');
                setSelectedImages([]);
                setEditModalVisible(false);
                setPosts([]);
                setAuthorMap({});
                
                Alert.alert('Success', 'Your goods & services profile has been removed.');
                
                // Force refresh all data
                await Promise.all([
                  fetchPosts(),
                  fetchUserProfile(),
                  fetchRecentReviews()
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to clear profile');
              }
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to clear profile');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const pickImages = async () => {
    try {
      const capacity = Math.max(0, 5 - selectedImages.length);
      if (capacity <= 0) {
        Alert.alert('Limit Reached', 'You can only add up to 5 photos.');
        return;
      }
      
      const photoService = new MobilePhotoUpload();
      const images = await photoService.pickMultipleImages(capacity);
      
      if (images && images.length > 0) {
        setSelectedImages(prev => [...prev, ...images]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const renderMediaGrid = (mediaArr) => {
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) return null;
    
    // Handle both object format {url: "..."} and string format "..."
    const images = mediaArr
      .map((m) => {
        let url = null;
        if (typeof m === 'string' && m.trim() !== '') {
          url = m.trim().replace(/\?$/, '');
        } else if (m && typeof m === 'object' && m.url && typeof m.url === 'string' && m.url.trim() !== '') {
          url = m.url.trim().replace(/\?$/, '');
        }
        
        if (!url) return null;
        
        // Ensure URL is properly formatted for Supabase storage
        if (!url.startsWith('http') && !url.startsWith('data:')) {
          // If it's a relative path, make it absolute
          if (url.startsWith('/')) {
            url = `${API_BASE_URL}${url}`;
          }
        }
        
        return { url };
      })
      .filter(Boolean)
      .slice(0, 5);
    
    if (images.length === 0) return null;
    
    console.log('Rendering media grid with images:', images);
    
    return (
      <View style={styles.mediaContainer}>
        <View style={styles.mediaGrid}>
          {images.slice(0, 4).map((m, idx) => (
            <TouchableOpacity key={idx} style={styles.imageWrapper}>
              <Image 
                source={{ uri: m.url }} 
                style={styles.gridImage} 
                resizeMode="cover"
                onError={(error) => {
                  console.error('Image load error:', error.nativeEvent.error, 'URL:', m.url);
                }}
                onLoad={() => {
                  console.log('Image loaded successfully:', m.url);
                }}
                defaultSource={require('../../../assets/icon.png')}
              />
              {idx === 3 && images.length > 4 && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{images.length - 4}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    // Get reviews specific to this driver/owner
    const driverReviews = reviews.filter(review => 
      review.driver_id === item.author_id || 
      review.package_owner_id === item.author_id
    );
    
    // Calculate average rating for this driver
    const avgRating = driverReviews.length > 0 
      ? driverReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / driverReviews.length
      : 0;

    const authorFromMap = authorMap[item.author_id] || {};
    
    // Get media from multiple possible sources
    let mediaArray = [];
    
    // Helper function to normalize URL
    const normalizeUrl = (url) => {
      if (!url || typeof url !== 'string') return null;
      const cleanUrl = url.trim();
      if (!cleanUrl) return null;
      
      // If it's already a complete URL, return as is
      if (cleanUrl.startsWith('http') || cleanUrl.startsWith('data:')) {
        return cleanUrl;
      }
      
      // If it's a relative path, make it absolute
      if (cleanUrl.startsWith('/')) {
        return `${API_BASE_URL}${cleanUrl}`;
      }
      
      return cleanUrl;
    };
    
    // Try media field first - handle both string URLs and objects with url property
    if (item.media && Array.isArray(item.media) && item.media.length > 0) {
      console.log('Processing media array:', item.media);
      const validMedia = item.media
        .map(m => {
          let url = null;
          if (typeof m === 'string' && m.trim()) {
            url = m.trim();
          } else if (m && typeof m === 'object' && m.url && typeof m.url === 'string' && m.url.trim()) {
            url = m.url.trim();
          }
          
          if (!url) return null;
          
          // Ensure URL is properly formatted
          if (!url.startsWith('http') && !url.startsWith('data:')) {
            if (url.startsWith('/')) {
              url = `${API_BASE_URL}${url}`;
            }
          }
          
          console.log('Processed media URL:', url);
          return { url };
        })
        .filter(Boolean);
      
      console.log('Valid media after processing:', validMedia);
      if (validMedia.length > 0) {
        mediaArray = validMedia;
      }
    }
    
    // Fallback to other possible fields
    if (mediaArray.length === 0) {
      const fallbackFields = [
        item.photos,
        item.images, 
        item.profile_photos,
        authorFromMap.profile_photos
      ];
      
      for (const field of fallbackFields) {
        if (Array.isArray(field) && field.length > 0) {
          const validUrls = field
            .map(url => normalizeUrl(url))
            .filter(Boolean)
            .map(url => ({ url }));
          
          if (validUrls.length > 0) {
            mediaArray = validUrls;
            break;
          }
        }
      }
    }
    

    
    const displayName = (() => {
      // Try direct name fields first
      if (item.author_name && item.author_name.trim()) return item.author_name.trim();
      
      // Try first/middle/last name combination
      const first = item.author_first_name || item.first_name || '';
      const middle = item.author_middle_name || item.middle_name || '';
      const last = item.author_last_name || item.last_name || '';
      const combined = [first, middle, last].filter(Boolean).join(' ').trim();
      if (combined) return combined;
      
      // Try from author map (fetched user profile)
      if (authorFromMap?.name && authorFromMap.name.trim() && !authorFromMap.name.includes('User')) {
        return authorFromMap.name.trim();
      }
      
      // Try full email as fallback
      const email = item.author_email || item.email || authorFromMap?.email || '';
      if (email) return email;
      
      const role = item.author_role || authorFromMap?.role || 'User';
      return `${role} ${item.author_id?.slice(0, 8) || ''}`;
    })();
    
    const userRole = item.author_role || authorFromMap?.role || 'user';
    const userEmail = item.author_email || item.email || authorFromMap?.email || '';
    const userPhone = authorFromMap?.phone || '';
    // Try multiple sources for profile photo with better fallback handling
    let profilePhoto = null;
    
    // Priority order: item data first (from backend), then authorFromMap (from separate fetch)
    const photoSources = [
      item.author_profile_photo_url,
      item.profile_photo_url,
      item.avatar_url,
      authorFromMap?.profile_photo_url,
      authorFromMap?.avatar_url,
      authorFromMap?.profile_photo,
      getBestAvatarUrl(authorFromMap),
      getBestAvatarUrl(item)
    ];
    
    for (const source of photoSources) {
      if (source && typeof source === 'string' && source.trim() && !source.includes('ui-avatars.com')) {
        profilePhoto = source.trim();
        break;
      }
    }
    
    // Generate fallback avatar URL if no photo found
    if (!profilePhoto && displayName) {
      profilePhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6B2E2B&color=fff&size=128`;
    }
    
    console.log(`Profile photo for ${displayName}:`, profilePhoto);

    return (
      <View style={styles.card}>
        {/* Enhanced Header */}
        <View style={styles.headerRow}>
          <View style={styles.avatarContainer}>
            {profilePhoto ? (
              <Image 
                source={{ uri: profilePhoto }} 
                style={styles.avatar}
                onError={() => console.log('Avatar failed to load:', profilePhoto)}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {userRole && (
              <View style={styles.roleIndicator}>
                <Ionicons 
                  name={userRole.includes('driver') ? 'car' : 'business'} 
                  size={12} 
                  color={COLORS.white} 
                />
              </View>
            )}
          </View>
          <View style={styles.headerTextWrap}>
            <View style={styles.nameRow}>
              <Text style={styles.author} numberOfLines={1}>{displayName}</Text>
              {userRole && (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{String(userRole).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.contactRow}>
              {userEmail && (
                <TouchableOpacity 
                  style={styles.contactChip}
                  onPress={() => {
                    // Could implement email functionality here
                    console.log('Email:', userEmail);
                  }}
                >
                  <Ionicons name="mail" size={12} color={COLORS.primary} />
                  <Text style={styles.contactText} numberOfLines={1}>{userEmail}</Text>
                </TouchableOpacity>
              )}
              {userPhone && (
                <TouchableOpacity 
                  style={styles.contactChip}
                  onPress={() => {
                    // Could implement call functionality here
                    console.log('Phone:', userPhone);
                  }}
                >
                  <Ionicons name="call" size={12} color={COLORS.primary} />
                  <Text style={styles.contactText} numberOfLines={1}>{userPhone}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.timeText}>{getPostedOrUpdated(item)}</Text>
          </View>
        </View>

        {/* Content */}
        {item.title && <Text style={styles.title}>{item.title}</Text>}
        {item.description && <Text style={styles.description}>{item.description}</Text>}

        {/* Driver Rating */}
        {avgRating > 0 && (
          <View style={styles.ratingSection}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#FFB800" />
              <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({driverReviews.length} review{driverReviews.length !== 1 ? 's' : ''})</Text>
            </View>
          </View>
        )}

        {renderMediaGrid(mediaArray)}
        


        {/* Driver-specific Reviews */}
        {driverReviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.sectionTitle}>Customer Reviews ({driverReviews.length})</Text>
            </View>
            {driverReviews.slice(0, 3).map((rv, idx) => (
              <View key={rv.id || idx} style={styles.reviewItem}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewReviewer}>{rv.reviewer_name || rv.tourist_name || 'Customer'}</Text>
                  {Number.isFinite(Number(rv.rating)) && (
                    <Text style={styles.ratingText}>★ {Number(rv.rating).toFixed(1)}</Text>
                  )}
                </View>
                {rv.comment && (
                  <Text style={styles.reviewText} numberOfLines={2}>{rv.comment}</Text>
                )}
                {rv.created_at && (
                  <Text style={styles.reviewDate}>{formatDateTime(rv.created_at)}</Text>
                )}
              </View>
            ))}
            {driverReviews.length > 3 && (
              <Text style={styles.moreReviews}>+{driverReviews.length - 3} more reviews</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.logoContainer, { opacity: pulseAnim }]}>
          <Image 
            source={require('../../../assets/TarTrack Logo_sakto.png')} 
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.loadingText, { marginRight: 4 }]}>Loading goods & services</Text>
            <Animated.Text style={[styles.loadingText, { opacity: dot1Anim }]}>.</Animated.Text>
            <Animated.Text style={[styles.loadingText, { opacity: dot2Anim }]}>.</Animated.Text>
            <Animated.Text style={[styles.loadingText, { opacity: dot3Anim }]}>.</Animated.Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      {/* User's Profile Section for Drivers/Owners */}
      {isDriverOrOwner && (
        <View style={styles.userProfileCard}>
          <View style={styles.userProfileHeader}>
            <View style={styles.userAvatarContainer}>
              {getBestAvatarUrl(auth.user) ? (
                <Image source={{ uri: getBestAvatarUrl(auth.user) }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatar, { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.userAvatarText}>
                    {(auth.user?.name || auth.user?.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userRoleIndicator}>
                <Ionicons 
                  name={auth.user?.role === 'driver' ? 'car' : 'business'} 
                  size={10} 
                  color={COLORS.white} 
                />
              </View>
            </View>
            <View style={styles.userInfoSection}>
              <Text style={styles.userName}>{auth.user?.name || auth.user?.email || 'User'}</Text>
              <Text style={styles.userRole}>{auth.user?.role?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={() => {
                setEditModalVisible(true);
                setSelectedImages([]);
              }}
            >
              <Ionicons name={userProfile ? "create-outline" : "add-outline"} size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          {userProfile ? (
            <View style={styles.userBioSection}>
              <Text style={styles.userBioText}>{userProfile.description}</Text>
              <Text style={styles.userBioDate}>Updated {formatDateTime(userProfile.updated_at)}</Text>
              {/* Show user's own media */}
              {userProfile.media && userProfile.media.length > 0 && (
                <View style={styles.userMediaGrid}>
                  {userProfile.media.slice(0, 3).map((m, idx) => {
                    const url = typeof m === 'string' ? m : m?.url;
                    if (!url) return null;
                    return (
                      <TouchableOpacity key={idx} style={styles.userMediaItem}>
                        <Image source={{ uri: url }} style={styles.userMediaImage} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                  {userProfile.media.length > 3 && (
                    <View style={styles.userMediaMore}>
                      <Text style={styles.userMediaMoreText}>+{userProfile.media.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.addBioSection}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={styles.addBioText}>Add goods & services description...</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <FlatList
        data={posts}
        keyExtractor={(item, index) => `${item.id || index}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={48} color={COLORS.sub} />
            <Text style={styles.empty}>No goods & services posts yet.</Text>
            <Text style={styles.emptySubtext}>Drivers and owners can create posts to showcase their services.</Text>
          </View>
        ) : null}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              title={loading ? 'Loading...' : 'Refresh Data'}
              onPress={async () => {
                console.log('[GoodsServicesScreen] Manual refresh triggered');
                // Clear all data first
                setPosts([]);
                setAuthorMap({});
                setError('');
                
                // Force reload
                await Promise.all([
                  fetchPosts(),
                  fetchRecentReviews(),
                  fetchUserProfile()
                ]);
              }}
              disabled={loading}
            />
            {posts.length > 0 && (
              <Text style={styles.footerText}>
                Showing {posts.length} goods & services posts
              </Text>
            )}
          </View>
        }
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={true}
      />
      
      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditModalVisible(false)}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.headerSpacer} />
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={styles.modalSubtitle}>Showcase your services</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.sub} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.inputLabel}>Services Description</Text>
                </View>
                <View style={styles.textInputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Describe the goods and services you offer to customers..."
                    placeholderTextColor={COLORS.sub}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.inputFooter}>
                    <Text style={styles.charCount}>{editDescription.length} characters</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.inputLabel}>Photos ({selectedImages.length}/5)</Text>
                </View>
                
                <TouchableOpacity style={styles.addPhotoButton} onPress={pickImages}>
                  <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Add Photos</Text>
                </TouchableOpacity>
                

                
                {selectedImages.length > 0 && (
                  <View style={styles.selectedImagesContainer}>
                    {selectedImages.map((image, index) => (
                      <View key={index} style={styles.selectedImageWrapper}>
                        <Image source={{ uri: image.uri }} style={styles.selectedImage} />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close" size={16} color={COLORS.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <View style={styles.buttonContent}>
                      <Text style={styles.saveButtonText}>Saving...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name="checkmark" size={18} color={COLORS.white} />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                {userProfile && (
                  <TouchableOpacity 
                    style={styles.clearButton}
                    onPress={handleClearProfile}
                    disabled={saving}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons name="trash-outline" size={16} color="#DC3545" />
                      <Text style={styles.clearButtonText}>Remove</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const COLORS = {
  bg: '#F8F9FA',
  card: '#FFFFFF',
  text: '#1A1A1A',
  sub: '#6B7280',
  line: '#E5E7EB',
  primary: '#6B2E2B',
  secondary: '#F3F4F6',
  accent: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  white: '#FFFFFF',
  pillBg: '#FEF2F2',
  pillBorder: '#FECACA',
  pillText: '#991B1B',
};

const RADIUS = 14;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  listContent: { padding: 16, paddingBottom: 100 },
  error: { color: 'red', padding: 16 },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 230,
    height: 230,
  },
  loadingText: {
    marginTop:-150,
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginLeft:2
  },
  
  // User Profile Section (Facebook-style)
  userProfileCard: {
    backgroundColor: COLORS.card,
    margin: 16,
    marginBottom: 8,
    borderRadius: RADIUS,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  userProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.secondary,
  },
  userAvatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 20,
  },
  userRoleIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userInfoSection: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.sub,
    letterSpacing: 0.5,
  },
  editProfileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBioSection: {
    paddingTop: 8,
  },
  userBioText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  userBioDate: {
    color: COLORS.sub,
    fontSize: 12,
  },
  addBioSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    marginTop: 4,
  },
  addBioText: {
    color: COLORS.sub,
    fontSize: 15,
    fontStyle: 'italic',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.sub,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 32,
  },
  modalContent: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  textInputWrapper: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  textInput: {
    padding: 16,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 120,
    lineHeight: 22,
  },
  inputFooter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.sub,
    textAlign: 'right',
  },
  actionButtons: {
    gap: 10,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearButtonText: {
    color: '#DC3545',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: 16,
  },
  addPhotoText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedImageWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  empty: { 
    textAlign: 'center', 
    color: COLORS.text, 
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    textAlign: 'center',
    color: COLORS.sub,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  muted: { color: COLORS.sub, fontSize: 12 },

  // Footer refresh button stays
  footer: { padding: 16 },
  footerText: {
    textAlign: 'center',
    color: COLORS.sub,
    fontSize: 12,
    marginTop: 8,
  },

  // Card (modern & simple)
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // Enhanced header
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginBottom: 16 
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: COLORS.primary, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 18,
  },
  roleIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  headerTextWrap: { 
    flex: 1, 
    minWidth: 0 
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  author: { 
    fontWeight: '700', 
    color: COLORS.text, 
    fontSize: 16,
    flex: 1,
  },
  pill: {
    backgroundColor: COLORS.pillBg,
    borderColor: COLORS.pillBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pillText: { 
    color: COLORS.pillText, 
    fontWeight: '600', 
    fontSize: 10, 
    letterSpacing: 0.5 
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    maxWidth: 200,
  },
  contactText: { 
    fontSize: 12, 
    color: COLORS.primary, 
    fontWeight: '500',
    maxWidth: 120,
  },
  timeText: { 
    fontSize: 12, 
    color: COLORS.sub, 
    fontWeight: '500' 
  },

  // Content text
  title: { 
    color: COLORS.text, 
    fontWeight: '700', 
    fontSize: 17, 
    marginBottom: 8, 
    lineHeight: 24 
  },

  description: { 
    color: COLORS.text, 
    lineHeight: 22, 
    fontSize: 15, 
    marginBottom: 4 
  },
  
  // Rating section
  ratingSection: {
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingValue: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
  },
  ratingCount: {
    color: COLORS.sub,
    fontSize: 14,
  },

  // Facebook-style media grid
  mediaContainer: {
    marginVertical: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  imageWrapper: {
    position: 'relative',
    width: (width - 34) / 2 - 1,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  captionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },

  // Compact reviews
  reviewsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: COLORS.sub,
  },
  reviewItem: {
    marginBottom: 8,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewReviewer: { 
    fontWeight: '600', 
    color: COLORS.text, 
    fontSize: 12,
  },
  ratingText: { 
    color: '#FFB800', 
    fontWeight: '600', 
    fontSize: 12 
  },
  reviewText: { 
    color: COLORS.sub, 
    fontSize: 12, 
    lineHeight: 16,
  },
  reviewDate: {
    color: COLORS.sub,
    fontSize: 10,
    marginTop: 2,
  },
  moreReviews: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // User media styles
  userMediaGrid: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  userMediaItem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  userMediaImage: {
    width: '100%',
    height: '100%',
  },
  userMediaMore: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMediaMoreText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
});

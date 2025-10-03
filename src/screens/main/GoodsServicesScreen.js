import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Button from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { listGoodsServicesPosts, getGoodsServicesProfileByAuthor, upsertGoodsServicesProfile, deleteGoodsServicesPost } from '../../services/goodsServices';
import { listReviews } from '../../services/reviews';
import { getUserProfile } from '../../services/authService';
import { standardizeUserProfile, getBestAvatarUrl } from '../../utils/profileUtils';

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
  const [saving, setSaving] = useState(false);
  
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
      const result = await getGoodsServicesProfileByAuthor(auth.user.id);
      if (result.success) {
        setUserProfile(result.data);
        setEditDescription(result.data?.description || '');
      }
    } catch (e) {
      console.error('Failed to fetch user profile:', e);
    }
  }, [auth.user?.id, isDriverOrOwner]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listGoodsServicesPosts();
      if (result.success) {
        setPosts(Array.isArray(result.data) ? result.data : []);
      } else {
        setError(result.error || 'Failed to load posts');
      }
    } catch (e) {
      setError(e.message || 'Failed to load posts');
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
                return { 
                  id, 
                  ...standardizedProfile,
                  profile_photos: userData.profile_photos || userData.photos || []
                };
              }
            } catch (error) {
              console.warn('Failed to fetch profile for user:', id, error.message);
            }
            return { id, name: '', email: '', role: 'user', phone: '' };
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
    await Promise.all([fetchPosts(), fetchRecentReviews(), fetchUserProfile()]);
    setRefreshing(false);
  }, [fetchPosts, fetchRecentReviews, fetchUserProfile]);

  const handleSaveProfile = async () => {
    if (!auth.user?.id) return;
    setSaving(true);
    try {
      const result = await upsertGoodsServicesProfile(auth.user.id, editDescription.trim());
      if (result.success) {
        setUserProfile(result.data);
        setEditModalVisible(false);
        Alert.alert('Success', 'Your goods & services profile has been updated.');
        fetchPosts(); // Refresh to show updated post
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
                setUserProfile(null);
                setEditDescription('');
                setEditModalVisible(false);
                Alert.alert('Success', 'Your goods & services profile has been removed.');
                fetchPosts(); // Refresh to remove from list
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

  const renderMediaGrid = (mediaArr) => {
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) return null;
    
    const images = mediaArr
      .filter((m) => m && typeof m === 'object' && m.url && typeof m.url === 'string' && m.url.trim() !== '')
      .map((m) => ({ ...m, url: m.url.replace(/\?$/, '') }))
      .slice(0, 5);
    
    if (images.length === 0) return null;
    
    return (
      <View style={styles.mediaContainer}>
        <View style={styles.mediaGrid}>
          {images.slice(0, 4).map((m, idx) => (
            <TouchableOpacity key={idx} style={styles.imageWrapper}>
              <Image source={{ uri: m.url }} style={styles.gridImage} resizeMode="cover" />
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
    
    // Handle the media field which might be an array of objects or just [Array] placeholder
    if (item.media && Array.isArray(item.media) && item.media.length > 0) {
      // Check if it's actual media objects or just placeholder
      const firstItem = item.media[0];
      if (firstItem && typeof firstItem === 'object' && firstItem.url) {
        // Ensure URLs point to goods-storage bucket
        mediaArray = item.media.map(media => ({
          ...media,
          url: media.url.includes('goods-storage') ? media.url : media.url.replace('/storage/v1/object/public/', '/storage/v1/object/public/goods-storage/')
        }));
      }
    }
    
    // Fallback to other possible fields
    if (mediaArray.length === 0) {
      if (Array.isArray(item.photos) && item.photos.length > 0) {
        mediaArray = item.photos.map(url => ({ url: url.includes('goods-storage') ? url : url.replace('/storage/v1/object/public/', '/storage/v1/object/public/goods-storage/') }));
      } else if (Array.isArray(item.images) && item.images.length > 0) {
        mediaArray = item.images.map(url => ({ url: url.includes('goods-storage') ? url : url.replace('/storage/v1/object/public/', '/storage/v1/object/public/goods-storage/') }));
      } else if (Array.isArray(item.profile_photos) && item.profile_photos.length > 0) {
        mediaArray = item.profile_photos.map(url => ({ url: url.includes('goods-storage') ? url : url.replace('/storage/v1/object/public/', '/storage/v1/object/public/goods-storage/') }));
      } else if (Array.isArray(authorFromMap.profile_photos) && authorFromMap.profile_photos.length > 0) {
        mediaArray = authorFromMap.profile_photos.map(url => ({ url: url.includes('goods-storage') ? url : url.replace('/storage/v1/object/public/', '/storage/v1/object/public/goods-storage/') }));
      }
    }
    
    console.log('Media array for item:', item.id, mediaArray);
    
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
    const profilePhoto = getBestAvatarUrl(authorFromMap || item);

    return (
      <View style={styles.card}>
        {/* Enhanced Header */}
        <View style={styles.headerRow}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: profilePhoto }} style={styles.avatar} />
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

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      {/* User's Profile Section for Drivers/Owners */}
      {isDriverOrOwner && (
        <View style={styles.userProfileSection}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileTitle}>My Goods & Services</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setEditModalVisible(true)}
            >
              <Ionicons name={userProfile ? "create-outline" : "add-outline"} size={20} color={COLORS.primary} />
              <Text style={styles.editButtonText}>{userProfile ? 'Edit' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
          
          {userProfile ? (
            <View style={styles.currentProfile}>
              <Text style={styles.currentDescription}>{userProfile.description}</Text>
              <Text style={styles.profileDate}>Updated {formatDateTime(userProfile.updated_at)}</Text>
            </View>
          ) : (
            <Text style={styles.noProfile}>No goods & services profile yet. Create one to showcase your services.</Text>
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
              title={loading ? 'Loading...' : 'Refresh'}
              onPress={() => {
                fetchPosts();
                fetchRecentReviews();
                fetchUserProfile();
              }}
            />
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
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Goods & Services</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.disabledButton]}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Describe your goods and services:</Text>
            <TextInput
              style={styles.textInput}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Tell customers about the goods and services you offer..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            
            {userProfile && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={handleClearProfile}
                disabled={saving}
              >
                <Ionicons name="trash-outline" size={16} color="#DC3545" />
                <Text style={styles.clearButtonText}>Remove Profile</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
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
  
  // User Profile Section
  userProfileSection: {
    backgroundColor: COLORS.card,
    margin: 16,
    marginBottom: 8,
    borderRadius: RADIUS,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
  },
  editButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  currentProfile: {
    padding: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
  },
  currentDescription: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  profileDate: {
    color: COLORS.sub,
    fontSize: 12,
  },
  noProfile: {
    color: COLORS.sub,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
    backgroundColor: COLORS.card,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  cancelButton: {
    color: COLORS.sub,
    fontSize: 16,
  },
  saveButton: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.line,
    minHeight: 120,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC3545',
    backgroundColor: '#FFF5F5',
  },
  clearButtonText: {
    color: '#DC3545',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginTop: 20,
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
});

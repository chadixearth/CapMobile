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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Button from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { listGoodsServicesPosts } from '../../services/goodsServices';
import { listReviews } from '../../services/reviews';
import { getUserProfile } from '../../services/authService';

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

  const formatDateTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString(); } catch { return String(d); }
  };
  const getPostedOrUpdated = (item) => {
    const hasUpdate = item?.updated_at && item.updated_at !== item.created_at;
    const ts = hasUpdate ? item.updated_at : item.created_at;
    return `${hasUpdate ? 'Updated' : 'Posted'} ${formatDateTime(ts)}`;
  };

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
      const res = await listReviews({ limit: 20, include_stats: false });
      if (res.success) {
        const arr = Array.isArray(res.data) ? res.data : [];
        setReviews(arr);
      }
    } catch (_) {
      // ignore errors, leave reviews empty
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

        const results = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await getUserProfile(id);
              if (res.success && res.data) {
                const userData = res.data;
                const name = userData.name || 
                           userData.full_name ||
                           [userData.first_name, userData.middle_name, userData.last_name].filter(Boolean).join(' ').trim() ||
                           userData.email || 
                           `${userData.role || 'User'}`;
                return { 
                  id, 
                  name, 
                  email: userData.email || '', 
                  role: userData.role || 'user',
                  phone: userData.phone || ''
                };
              }
            } catch {}
            return { id, name: '', email: '', role: 'user', phone: '' };
          })
        );

        const mapUpdate = {};
        for (const r of results) {
          mapUpdate[r.id] = { name: r.name, email: r.email, role: r.role, phone: r.phone };
        }
        setAuthorMap(mapUpdate);
      } catch {}
    };
    run();
  }, [posts]);

  // Refresh data when screen comes into focus (fixes photo not showing after bio update)
  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      fetchRecentReviews();
    }, [fetchPosts, fetchRecentReviews])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPosts(), fetchRecentReviews()]);
    setRefreshing(false);
  }, [fetchPosts, fetchRecentReviews]);

  // Enhanced media grid with better layout
  const renderMediaGrid = (mediaArr) => {
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) return null;
    const images = mediaArr.filter((m) => m?.url).slice(0, 4);
    if (images.length === 0) return null;
    
    const getImageStyle = (index, total) => {
      if (total === 1) return [styles.mediaTile, styles.singleImage];
      if (total === 2) return [styles.mediaTile, styles.doubleImage];
      if (total === 3) {
        return index === 0 ? [styles.mediaTile, styles.tripleMain] : [styles.mediaTile, styles.tripleSide];
      }
      return [styles.mediaTile, styles.quadImage];
    };
    
    return (
      <View style={styles.mediaContainer}>
        <View style={styles.mediaGrid}>
          {images.map((m, idx) => (
            <TouchableOpacity key={idx} activeOpacity={0.8}>
              <Image 
                source={{ uri: m.url }} 
                style={getImageStyle(idx, images.length)}
                resizeMode="cover"
              />
              {images.length > 4 && idx === 3 && (
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
    const sampleReviews = reviews.slice(0, 3);

    const authorFromMap = authorMap[item.author_id] || {};
    
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

    return (
      <View style={styles.card}>
        {/* Enhanced Header */}
        <View style={styles.headerRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
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
                <View style={styles.contactChip}>
                  <Ionicons name="mail" size={12} color={COLORS.primary} />
                  <Text style={styles.contactText} numberOfLines={1}>{userEmail}</Text>
                </View>
              )}
              {userPhone && (
                <View style={styles.contactChip}>
                  <Ionicons name="call" size={12} color={COLORS.primary} />
                  <Text style={styles.contactText} numberOfLines={1}>{userPhone}</Text>
                </View>
              )}
            </View>
            <Text style={styles.timeText}>{getPostedOrUpdated(item)}</Text>
          </View>
        </View>

        {/* Content */}
        {item.title && <Text style={styles.title}>{item.title}</Text>}
        {item.description && <Text style={styles.description}>{item.description}</Text>}

        {renderMediaGrid(item.media)}

        {/* Compact Reviews */}
        {sampleReviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.sectionTitle}>Reviews ({sampleReviews.length})</Text>
            </View>
            {sampleReviews.slice(0, 2).map((rv, idx) => (
              <View key={rv.id || idx} style={styles.reviewItem}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewReviewer}>{rv.reviewer_name || 'Tourist'}</Text>
                  {Number.isFinite(Number(rv.rating)) && (
                    <Text style={styles.ratingText}>★ {Number(rv.rating).toFixed(1)}</Text>
                  )}
                </View>
                {rv.comment && (
                  <Text style={styles.reviewText} numberOfLines={2}>{rv.comment}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={posts}
        keyExtractor={(item, index) => `${item.id || index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No posts yet.</Text> : null}
      />

      {/* ✅ Keep the refresh button (no custom request button) */}
      <View style={styles.footer}>
        <Button
          title={loading ? 'Loading...' : 'Refresh'}
          onPress={() => {
            fetchPosts();
            fetchRecentReviews();
          }}
        />
      </View>
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
  listContent: { padding: 16, paddingBottom: 24 },
  error: { color: 'red', padding: 16 },
  empty: { textAlign: 'center', color: COLORS.sub, marginTop: 28 },
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

  // Enhanced media grid
  mediaContainer: {
    marginVertical: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mediaTile: {
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: 200,
  },
  doubleImage: {
    width: '49%',
    height: 120,
  },
  tripleMain: {
    width: '60%',
    height: 140,
  },
  tripleSide: {
    width: '38%',
    height: 67,
  },
  quadImage: {
    width: '49%',
    height: 100,
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
});

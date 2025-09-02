import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button'; // ✅ keep the refresh button
import { useAuth } from '../../hooks/useAuth';
import { listGoodsServicesPosts } from '../../services/goodsServices';
import { listReviews } from '../../services/reviews';
import { getUserProfile } from '../../services/authService';

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

  // Resolve author names for posts that lack a concrete name
  useEffect(() => {
    const run = async () => {
      try {
        const missingIds = Array.from(
          new Set(
            (Array.isArray(posts) ? posts : [])
              .map((p) => p.author_id)
              .filter(Boolean)
              .filter((id) => !authorMap[id])
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
                           userData.email?.split('@')[0] || 
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
            return { id, name: `User ${id.slice(0, 8)}`, email: '', role: 'user', phone: '' };
          })
        );

        const mapUpdate = { ...authorMap };
        for (const r of results) {
          mapUpdate[r.id] = { name: r.name, email: r.email, role: r.role, phone: r.phone };
        }
        setAuthorMap(mapUpdate);
      } catch {}
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  useEffect(() => {
    // Load posts and reviews on mount
    fetchPosts();
    fetchRecentReviews();
  }, [fetchPosts, fetchRecentReviews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPosts(), fetchRecentReviews()]);
    setRefreshing(false);
  }, [fetchPosts, fetchRecentReviews]);

  // Modern media grid (2x2) — simple + clean
  const renderMediaGrid = (mediaArr) => {
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) return null;
    const images = mediaArr.filter((m) => m?.url).slice(0, 4);
    return (
      <View style={styles.mediaGrid}>
        {images.map((m, idx) => (
          <Image key={idx} source={{ uri: m.url }} style={styles.mediaTile} />
        ))}
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
      
      // Try full email as fallback (not just part before @)
      const email = item.author_email || item.email || authorFromMap?.email || '';
      if (email && email.includes('@')) return email;
      
      // Final fallback to role with ID
      const role = item.author_role || authorFromMap?.role || 'User';
      return `${role} ${item.author_id?.slice(0, 8) || ''}`;
    })();
    
    const userRole = item.author_role || authorFromMap?.role || 'user';
    const userEmail = item.author_email || authorFromMap?.email || '';
    const userPhone = authorFromMap?.phone || '';

    return (
      <View style={styles.card}>
        {/* Header: Avatar + Name + Role + Contact Info */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.author} numberOfLines={1}>{displayName}</Text>
            <View style={styles.metaWrap}>
              {!!userRole && (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{String(userRole).toUpperCase()}</Text>
                </View>
              )}
              {!!userEmail && (
                <Text style={styles.contactText} numberOfLines={1}>📧 {userEmail}</Text>
              )}
              {!!userPhone && (
                <Text style={styles.contactText} numberOfLines={1}>📱 {userPhone}</Text>
              )}
            </View>
            <Text style={styles.timeText} numberOfLines={1}>{getPostedOrUpdated(item)}</Text>
          </View>
        </View>

        {/* Content */}
        {!!item.title && <Text style={styles.title} numberOfLines={2}>{item.title}</Text>}
        {!!item.description && <Text style={styles.description} numberOfLines={5}>{item.description}</Text>}

        {renderMediaGrid(item.media)}

        {/* Reviews */}
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubbles-outline" size={14} color={COLORS.pillText} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
        </View>

        <View style={styles.reviewBox}>
          {loadingReviews ? (
            <Text style={styles.muted}>Loading reviews...</Text>
          ) : sampleReviews.length === 0 ? (
            <Text style={styles.muted}>No reviews yet.</Text>
          ) : (
            sampleReviews.map((rv, idx) => (
              <View key={rv.id || idx} style={styles.reviewItem}>
                <View style={styles.reviewTopRow}>
                  <Text style={styles.reviewReviewer} numberOfLines={1}>
                    {rv.reviewer_name || 'Tourist'}
                  </Text>
                  {Number.isFinite(Number(rv.rating)) && (
                    <View style={styles.ratingChip}>
                      <Text style={styles.ratingText}>★ {Number(rv.rating).toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                {!!rv.comment && (
                  <Text style={styles.reviewText} numberOfLines={3}>{rv.comment}</Text>
                )}
                <Text style={styles.reviewTime}>
                  {formatDateTime(rv.created_at || rv.updated_at || Date.now())}
                </Text>
              </View>
            ))
          )}
        </View>
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
  bg: '#F7F7F8',
  card: '#FFFFFF',
  text: '#1E1E1E',
  sub: '#6F6F6F',
  line: '#EAEAEA',
  pillBg: '#F2E9E6',
  pillBorder: '#E7D6CE',
  pillText: '#6B2E2B',
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

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: COLORS.pillBg, 
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.pillBorder,
  },
  avatarText: {
    color: COLORS.pillText,
    fontWeight: '700',
    fontSize: 18,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  author: { fontWeight: '700', color: COLORS.text, fontSize: 16 },
  metaWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  pill: {
    backgroundColor: COLORS.pillBg,
    borderColor: COLORS.pillBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: { color: COLORS.pillText, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  timeText: { fontSize: 12, color: COLORS.sub, flexShrink: 1, marginTop: 4 },
  contactText: { fontSize: 11, color: COLORS.sub, flexShrink: 1 },

  // Content text
  title: { color: COLORS.text, fontWeight: '700', fontSize: 16, marginBottom: 6, lineHeight: 22 },
  description: { color: '#2D2D2D', lineHeight: 20, fontSize: 14, marginBottom: 10 },

  // Media grid (2x2)
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  mediaTile: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 12,
    backgroundColor: '#EEE',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text },

  // Reviews
  reviewBox: {
    backgroundColor: '#FBF7F4',
    borderWidth: 1,
    borderColor: '#EFE1D9',
    borderRadius: 12,
    padding: 10,
  },
  reviewItem: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#efefef' },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewReviewer: { fontWeight: '700', color: COLORS.text, flexShrink: 1, marginRight: 8 },
  ratingChip: {
    backgroundColor: COLORS.pillBg,
    borderColor: COLORS.pillBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ratingText: { color: COLORS.pillText, fontWeight: '800', fontSize: 12 },
  reviewText: { color: '#333', marginTop: 4, fontSize: 12, lineHeight: 18 },
  reviewTime: { color: COLORS.sub, fontSize: 11, marginTop: 4 },
});

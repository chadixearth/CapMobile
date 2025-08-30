import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, RefreshControl, ScrollView } from 'react-native';
import Button from '../../components/Button';
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

        // Fetch profiles in parallel (lightweight; backend returns name/email)
        const results = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await getUserProfile(id);
              if (res.success && res.data) {
                const name = res.data.name || [res.data.first_name, res.data.last_name].filter(Boolean).join(' ').trim();
                return { id, name: name || '', email: res.data.email || '' };
              }
            } catch {}
            return { id, name: '', email: '' };
          })
        );

        const mapUpdate = { ...authorMap };
        for (const r of results) {
          mapUpdate[r.id] = { name: r.name, email: r.email };
        }
        setAuthorMap(mapUpdate);
      } catch {}
    };
    run();
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

  const renderMediaGallery = (mediaArr) => {
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) return null;
    const images = mediaArr.filter((m) => m?.url).slice(0, 6);
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
        {images.map((m, idx) => (
          <Image key={idx} source={{ uri: m.url }} style={styles.mediaThumb} />
        ))}
      </ScrollView>
    );
  };

  const renderItem = ({ item }) => {
    const sampleReviews = reviews.slice(0, 3);

    const displayName = (() => {
      const first = item.author_first_name || item.first_name || '';
      const last = item.author_last_name || item.last_name || '';
      const combined = [first, last].filter(Boolean).join(' ').trim();
      if (combined) return combined;
      const authorFromMap = authorMap[item.author_id]?.name;
      if (authorFromMap && authorFromMap.trim()) return authorFromMap;
      const email = item.author_email || item.email || authorMap[item.author_id]?.email || '';
      if (email) return email;
      return item.author_name && !/^\s*$/.test(item.author_name) ? item.author_name : String(item.author_role || '').toUpperCase();
    })();

    return (
      <View style={styles.card}>
        <View style={styles.contentRow}>
          {/* Left: Driver/Owner profile with text and photos */}
          <View style={styles.leftCol}>
            <View style={styles.headerRow}>
              <View style={styles.avatarPlaceholder} />
              <View style={{ flex: 1 }}>
                <Text style={styles.author}>
                  {displayName}
                </Text>
                <View style={styles.metaRow}>
                  {!!item.author_role && (
                    <View style={styles.rolePill}>
                      <Text style={styles.rolePillText}>{String(item.author_role).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.date}>{getPostedOrUpdated(item)}</Text>
                </View>
              </View>
            </View>
            {renderMediaGallery(item.media)}
            {!!item.description && <Text style={styles.description}>{item.description}</Text>}
          </View>

          {/* Right: Reviews */}
          <View style={styles.rightCol}>
            <Text style={styles.reviewPanelTitle}>Reviews</Text>
            {loadingReviews ? (
              <Text style={styles.loadingText}>Loading reviews...</Text>
            ) : sampleReviews.length === 0 ? (
              <Text style={styles.reviewEmpty}>No reviews yet.</Text>
            ) : (
              sampleReviews.map((rv, idx) => (
                <View key={rv.id || idx} style={styles.reviewItem}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewReviewer} numberOfLines={1}>
                      {rv.reviewer_name || 'Tourist'}
                    </Text>
                    {Number.isFinite(Number(rv.rating)) && (
                      <View style={styles.reviewRatingBox}>
                        <Text style={styles.reviewRatingText}>★ {Number(rv.rating).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  {!!rv.comment && (
                    <Text style={styles.reviewText} numberOfLines={3}>
                      {rv.comment}
                    </Text>
                  )}
                  <Text style={styles.reviewTime}>
                    {formatDateTime(rv.created_at || rv.updated_at || Date.now())}
                  </Text>
                </View>
              ))
            )}
          </View>
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
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No posts yet.</Text> : null}
      />
      {/* Quick refresh button at bottom */}
      <View style={styles.footer}>
        <Button title={loading ? 'Loading...' : 'Refresh'} onPress={() => { fetchPosts(); fetchRecentReviews(); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  error: { color: 'red', padding: 12 },
  empty: { textAlign: 'center', color: '#777', marginTop: 24 },
  loadingText: { textAlign: 'center', color: '#777', marginVertical: 8 },
  footer: { padding: 12 },

  // Card layout
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  contentRow: { flexDirection: 'row', gap: 12 },
  leftCol: { flex: 2, minWidth: 0 },
  rightCol: { flex: 1, minWidth: 0 },

  // Left column (profile + content)
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rolePill: { backgroundColor: '#F5E9E2', borderColor: '#E0CFC2', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  rolePillText: { color: '#6B2E2B', fontWeight: '700', fontSize: 10 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEE', marginRight: 8 },
  author: { fontWeight: '600', color: '#222' },
  date: { fontSize: 12, color: '#999' },
  mediaThumb: { width: 140, height: 100, borderRadius: 8, backgroundColor: '#EEE', marginRight: 8 },
  description: { color: '#333' },

  // Right column (reviews beside)
  reviewPanelTitle: { fontSize: 14, fontWeight: '800', color: '#222', marginBottom: 4 },
  reviewEmpty: { color: '#777', fontSize: 12 },
  reviewItem: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewReviewer: { fontWeight: '700', color: '#222', flexShrink: 1, marginRight: 8 },
  reviewRatingBox: { backgroundColor: '#F5E9E2', borderColor: '#E0CFC2', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  reviewRatingText: { color: '#6B2E2B', fontWeight: '800', fontSize: 12 },
  reviewText: { color: '#333', marginTop: 4, fontSize: 12 },
  reviewTime: { color: '#999', fontSize: 11, marginTop: 2 },
});

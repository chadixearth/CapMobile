import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, RefreshControl } from 'react-native';
import Button from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { listGoodsServicesPosts } from '../../services/goodsServices';

export default function GoodsServicesScreen() {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);

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

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const renderMedia = (mediaArr) => {
    if (!Array.isArray(mediaArr) || mediaArr.length === 0) return null;
    const first = mediaArr[0];
    if (!first?.url) return null;
    return (
      <Image source={{ uri: first.url }} style={styles.media} />
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.avatarPlaceholder} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{(() => {
            const first = item.author_first_name || item.first_name || '';
            const last = item.author_last_name || item.last_name || '';
            const combined = [first, last].filter(Boolean).join(' ').trim();
            if (combined) return combined;
            const email = item.author_email || item.email || '';
            if (email) return email;
            return item.author_name || `${item.author_role || ''}`.toUpperCase();
          })()}</Text>
          <Text style={styles.date}>{new Date(item.created_at || Date.now()).toLocaleString()}</Text>
        </View>
      </View>
      {renderMedia(item.media)}
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

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
        <Button title={loading ? 'Loading...' : 'Refresh'} onPress={fetchPosts} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  error: { color: 'red', padding: 12 },
  empty: { textAlign: 'center', color: '#777', marginTop: 24 },
  footer: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEE', marginRight: 8 },
  author: { fontWeight: '600', color: '#222' },
  date: { fontSize: 12, color: '#999' },
  media: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#EEE', marginVertical: 8 },
  description: { color: '#333' },
});

// Goods & Services Posts API service
// Provides list/create/update/delete helpers for the goods_services_post endpoints
import { Platform, NativeModules } from 'react-native';
import { apiBaseUrl } from './networkConfig';

function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

const API_BASE_URL = apiBaseUrl();

async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, status: 0, data: { success: false, error: 'Request timeout' } };
    }
    return { ok: false, status: 0, data: { success: false, error: error.message || 'Network error' } };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Try multiple endpoints until one succeeds (useful while routes migrate)
async function requestWithFallback(paths, options) {
  let lastError = null;
  for (const p of paths) {
    const res = await request(p, options);
    if (res.ok) return res;
    // If it's a 404, try the next path; otherwise stop and return
    if (res.status !== 404) {
      return res;
    }
    lastError = res;
  }
  return lastError || { ok: false, status: 404, data: { error: 'Not found' } };
}

export async function listGoodsServicesPosts({ author_id, author_role } = {}) {
  const params = new URLSearchParams();
  if (author_id) params.append('author_id', author_id);
  if (author_role) params.append('author_role', author_role);
  const qs = params.toString();
  const res = await requestWithFallback([
    `/goods-services-profiles/${qs ? `?${qs}` : ''}`,
    `/goods-services-posts/${qs ? `?${qs}` : ''}`,
  ], { method: 'GET' });
  if (res.ok) {
    // The optimized list may return {results: [...]} or a raw array
    const items = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.data || []);
    return { success: true, data: items };
  }
  return { success: false, error: res.data?.error || 'Failed to fetch posts' };
}

export async function createGoodsServicesPost(authorId, description, media = []) {
  const payload = JSON.stringify({ author_id: authorId, description, media });
  const res = await requestWithFallback([
    '/goods-services-profiles/',
    '/goods-services-posts/',
  ], { method: 'POST', body: payload, timeoutMs: 30000 });
  if (res.ok) {
    return { success: true, data: res.data };
  }
  return { success: false, error: res.data?.error || 'Failed to create post' };
}

export async function updateGoodsServicesPost(postId, { author_id, description, is_active, media }) {
  const body = {};
  if (author_id) body.author_id = author_id;
  if (description !== undefined) body.description = description;
  if (is_active !== undefined) body.is_active = is_active;
  if (media !== undefined) body.media = media;
  const res = await requestWithFallback([
    `/goods-services-profiles/${postId}/`,
    `/goods-services-posts/${postId}/`,
  ], { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) return { success: true, data: res.data };
  return { success: false, error: res.data?.error || 'Failed to update post' };
}

export async function deleteGoodsServicesPost(postId, authorId) {
  const res = await requestWithFallback([
    `/goods-services-profiles/${postId}/`,
    `/goods-services-posts/${postId}/`,
  ], { method: 'DELETE', body: JSON.stringify({ author_id: authorId }) });
  if (res.ok) return { success: true };
  return { success: false, error: res.data?.error || 'Failed to delete post' };
}

// Convenience helpers for the new bio-style semantics
export async function getGoodsServicesProfileByAuthor(authorId) {
  if (!authorId) return { success: false, error: 'authorId is required' };
  const result = await listGoodsServicesPosts({ author_id: authorId });
  if (!result.success) return result;
  const items = Array.isArray(result.data) ? result.data : [];
  return { success: true, data: items[0] || null };
}

// Backend create now upserts, so this is a simple alias for clarity
export async function upsertGoodsServicesProfile(authorId, description, media = []) {
  return createGoodsServicesPost(authorId, description, media);
}

// Upload multiple images via the backend and return array of URLs
export async function uploadGoodsServicesMedia(userId, filesOrUris = []) {
  try {
    if (!Array.isArray(filesOrUris) || filesOrUris.length === 0) {
      return { success: true, urls: [] };
    }

    // Convert files to base64 for JSON payload
    const photos = [];
    for (let i = 0; i < filesOrUris.length; i++) {
      const item = filesOrUris[i];
      if (item && typeof item === 'object' && item.uri) {
        try {
          // Convert file to base64
          const response = await fetch(item.uri);
          const blob = await response.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          
          photos.push({
            photo: base64,
            filename: item.name || `photo_${Date.now()}_${i}.jpg`
          });
        } catch (err) {
          console.error('Failed to convert file to base64:', err);
          continue;
        }
      }
    }

    if (photos.length === 0) {
      return { success: false, error: 'No valid photos to upload' };
    }

    const payload = {
      photos,
      bucket_type: 'tourpackage',
      entity_id: userId
    };

    const res = await fetch(`${API_BASE_URL}/upload/multiple-photos/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      return { success: false, error: data?.error || data?.message || `Upload failed (${res.status})` };
    }

    // Extract URLs from response
    const uploadedPhotos = data?.data?.uploaded_photos || [];
    const urls = uploadedPhotos.map(photo => photo.url).filter(Boolean);

    return { success: true, urls };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to upload media' };
  }
}

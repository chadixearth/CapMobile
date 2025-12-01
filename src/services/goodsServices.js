// Goods & Services Posts API service
// Provides list/create/update/delete helpers for the goods_services_post endpoints
import { Platform, NativeModules } from 'react-native';
import { buildApiUrl, validateApiUrl } from './urlValidator';

function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}



async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const url = buildApiUrl(path);
  if (!validateApiUrl(url)) {
    throw new Error('Invalid API URL');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    console.log(`[goodsServices] Making request to: ${url}`);
    const response = await fetch(url, {
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
    console.log(`[goodsServices] Response status: ${response.status}, data:`, data);
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error(`[goodsServices] Request error:`, error);
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
  
  const res = await request(`/goods-services-profiles/${qs ? `?${qs}` : ''}`, { 
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'If-None-Match': ''
    }
  });
  
  if (res.ok) {
    // Handle multiple response formats
    let items = [];
    if (Array.isArray(res.data)) {
      items = res.data;
    } else if (res.data && typeof res.data === 'object') {
      items = res.data.results || res.data.data || res.data.items || [];
      // If it's a single object, wrap it in an array
      if (!Array.isArray(items) && res.data.id) {
        items = [res.data];
      }
    }
    
    console.log('[goodsServices] Fetched items:', items.length, 'posts');
    return { success: true, data: Array.isArray(items) ? items : [] };
  }
  
  console.error('[goodsServices] Failed to fetch posts:', res.status, res.data);
  return { success: false, error: res.data?.error || res.data?.message || 'Failed to fetch posts' };
}

export async function createGoodsServicesPost(authorId, description, media = []) {
  const payload = { 
    author_id: authorId, 
    description: description.trim(), 
    media: Array.isArray(media) ? media : [] 
  };
  console.log('[goodsServices] Creating/updating post with payload:', JSON.stringify(payload, null, 2));
  
  const res = await request('/goods-services-profiles/', { 
    method: 'POST', 
    body: JSON.stringify(payload), 
    timeoutMs: 30000,
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  console.log('[goodsServices] Create/update response:', JSON.stringify(res, null, 2));
  
  if (res.ok) {
    // Handle different response formats
    let responseData = res.data;
    if (res.data && typeof res.data === 'object') {
      responseData = res.data.data || res.data.result || res.data;
    }
    return { success: true, data: responseData };
  }
  
  console.error('[goodsServices] Failed to create/update post:', res.status, res.data);
  return { success: false, error: res.data?.error || res.data?.message || res.data?.detail || 'Failed to create post' };
}

export async function updateGoodsServicesPost(postId, { author_id, description, is_active, media }) {
  const body = {};
  if (author_id) body.author_id = author_id;
  if (description !== undefined) body.description = description;
  if (is_active !== undefined) body.is_active = is_active;
  if (media !== undefined) body.media = media;
  const res = await request(`/goods-services-profiles/${postId}/`, { method: 'PUT', body: JSON.stringify(body) });
  if (res.ok) return { success: true, data: res.data };
  return { success: false, error: res.data?.error || 'Failed to update post' };
}

export async function deleteGoodsServicesPost(postId, authorId) {
  const res = await request(`/goods-services-profiles/${postId}/`, { 
    method: 'DELETE', 
    body: JSON.stringify({ author_id: authorId }),
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  console.log('[goodsServices] Delete response:', res.status, res.data);
  
  if (res.ok) {
    return { success: true };
  }
  
  console.error('[goodsServices] Failed to delete post:', res.status, res.data);
  return { success: false, error: res.data?.error || res.data?.message || res.data?.detail || 'Failed to delete post' };
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
    console.log('[uploadGoodsServicesMedia] Starting upload for', filesOrUris.length, 'files');
    
    if (!Array.isArray(filesOrUris) || filesOrUris.length === 0) {
      return { success: true, urls: [] };
    }

    const urls = [];
    
    // Upload each file individually to the goods storage endpoint
    for (let i = 0; i < filesOrUris.length; i++) {
      const item = filesOrUris[i];
      console.log(`[uploadGoodsServicesMedia] Processing file ${i + 1}:`, item);
      
      if (item && typeof item === 'object' && item.uri) {
        try {
          console.log(`[uploadGoodsServicesMedia] Converting file ${i + 1} to base64...`);
          
          // Convert file to base64
          const response = await fetch(item.uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
          }
          
          const blob = await response.blob();
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          const payload = {
            file: base64,
            filename: item.name || `goods_media_${Date.now()}_${i}.jpg`,
            user_id: userId,
            category: 'goods_services'
          };

          console.log(`[uploadGoodsServicesMedia] Uploading file ${i + 1} with filename:`, payload.filename);

          const uploadUrl = buildApiUrl('/upload/goods-storage/');
          if (!validateApiUrl(uploadUrl)) {
            throw new Error('Invalid upload URL');
          }
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const uploadText = await uploadRes.text();
          let uploadData;
          try { 
            uploadData = JSON.parse(uploadText); 
          } catch { 
            uploadData = { raw: uploadText, success: false, error: 'Invalid JSON response' }; 
          }
          
          console.log(`[uploadGoodsServicesMedia] Upload response for file ${i + 1}:`, uploadData);
          
          if (uploadRes.ok && uploadData.success && uploadData.data?.url) {
            urls.push(uploadData.data.url);
            console.log(`[uploadGoodsServicesMedia] Successfully uploaded file ${i + 1}, URL:`, uploadData.data.url);
          } else {
            console.error(`[uploadGoodsServicesMedia] Failed to upload file ${i + 1}:`, uploadData.error || uploadData.raw || 'Unknown error');
          }
        } catch (err) {
          console.error(`[uploadGoodsServicesMedia] Error processing file ${i + 1}:`, err);
          continue;
        }
      } else {
        console.warn(`[uploadGoodsServicesMedia] Invalid file item at index ${i}:`, item);
      }
    }

    console.log('[uploadGoodsServicesMedia] Upload completed. URLs:', urls);
    return { success: urls.length > 0, urls };
  } catch (error) {
    console.error('[uploadGoodsServicesMedia] Upload failed:', error);
    return { success: false, error: error.message || 'Failed to upload media' };
  }
}

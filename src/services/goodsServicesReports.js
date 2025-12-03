import { buildApiUrl, validateApiUrl } from './urlValidator';

async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const url = buildApiUrl(path);
  if (!validateApiUrl(url)) {
    throw new Error('Invalid API URL');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
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

export async function reportGoodsServicesPost({ post_id, reporter_id, reporter_type, reason, details }) {
  const payload = {
    post_id,
    reporter_id,
    reporter_type,
    reason,
    details: details || ''
  };
  
  const res = await request('/goods-services-reports/', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  
  if (res.ok && res.data.success) {
    return { success: true, data: res.data.data, message: res.data.message };
  }
  
  return { success: false, error: res.data?.error || 'Failed to submit report' };
}

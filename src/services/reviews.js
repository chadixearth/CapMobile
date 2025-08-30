// Reviews API service
// Provides list helpers for package reviews endpoint
import { apiBaseUrl } from './networkConfig';

async function request(path, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
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

export async function listReviews({ package_id, booking_id, reviewer_id, limit = 10, include_stats = false } = {}) {
  const params = new URLSearchParams();
  if (package_id) params.append('package_id', package_id);
  if (booking_id) params.append('booking_id', booking_id);
  if (reviewer_id) params.append('reviewer_id', reviewer_id);
  if (limit) params.append('limit', String(limit));
  if (include_stats) params.append('include_stats', 'true');

  const qs = params.toString();
  const res = await request(`/reviews/${qs ? `?${qs}` : ''}`, { method: 'GET' });

  if (res.ok) {
    // Expected shape: { success: true, data: [...], count, stats? }
    const data = res.data?.data ?? res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
    const stats = res.data?.stats || null;
    return { success: true, data: Array.isArray(data) ? data : [], stats };
  }
  return { success: false, error: res.data?.error || 'Failed to fetch reviews' };
}


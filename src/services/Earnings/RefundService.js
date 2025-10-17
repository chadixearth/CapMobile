// services/Earnings/RefundService.js 
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';

// DRF routes (see RefundsViewSet): /api/refunds/
const BASE = `${apiBaseUrl()}/refunds`;

function authHeaders(extra = {}) {
  const token = getAccessToken?.();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * List refunds for current user
 * Backend filters by: tourist_id = current_user OR (tourist_id IS NULL AND booking.customer_id = current_user)
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20] - maps to ?page_size=
 * @param {string|null} [params.status] - 'pending' | 'approved' | 'rejected' | 'voided'
 * @param {string} [params.currentUserId] - current user ID for filtering
 */
export async function listRefunds({ page = 1, pageSize = 20, status = null, currentUserId = null } = {}) {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('page_size', String(pageSize));
  if (status) qs.set('status', status);
  if (currentUserId) qs.set('current_user', currentUserId);

  const res = await fetch(`${BASE}/?${qs.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await safeJson(res);
    return { success: false, error: err?.error || res.statusText };
  }

  const data = await res.json();
  return {
    success: true,
    page: data.page,
    pageSize: data.page_size,
    total: data.total,
    totalPages: data.total_pages,
    results: Array.isArray(data.results) ? data.results : [],
  };
}

export async function approveRefund(id, { remarks = '' } = {}) {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/approve/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ remarks }),
  });

  const json = await safeJson(res);
  if (!res.ok || json?.success === false) {
    return { success: false, error: json?.error || res.statusText };
  }
  return { success: true };
}

export async function rejectRefund(id, { remarks }) {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/reject/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ remarks }),
  });

  const json = await safeJson(res);
  if (!res.ok || json?.success === false) {
    return { success: false, error: json?.error || res.statusText };
  }
  return { success: true };
}

// ───────────────────────── helpers ─────────────────────────
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

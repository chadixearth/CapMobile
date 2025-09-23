// services/Earnings/BreakevenService.js
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';

const EARNINGS_API_BASE_URL = `${apiBaseUrl()}/breakeven/`;

/**
 * GET /breakeven/?driver_id=&period=&expenses=&display_tz=&bucket_tz=
 * - period: "today" | "week" | "month"
 * - display_tz: "ph" | "utc" (formatting only)
 * - bucket_tz: "ph" | "utc"  (how days/weeks/months are bucketed)
 */
export async function getBreakeven({
  driverId,
  period = 'today',
  expenses = 0,
  displayTz = 'ph',
  bucketTz = 'ph',
}) {
  const params = new URLSearchParams();
  if (driverId) params.append('driver_id', String(driverId));
  if (period) params.append('period', String(period));
  params.append('expenses', Number(expenses || 0).toString());
  params.append('display_tz', displayTz);
  params.append('bucket_tz', bucketTz);

  const url = `${EARNINGS_API_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const token = await getAccessToken().catch(() => null);
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: text || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    return { success: false, error: e?.message || 'Network error' };
  }
}

/**
 * GET /breakeven/history?driver_id=&period_type=&limit=&exclude_current=1
 * Bucketing for history follows the server's DEFAULT_BUCKET_TZ (env).
 */
export async function getBreakevenHistory({
  driverId,
  periodType = 'daily',
  limit = 30,
  excludeCurrent = true,
}) {
  const params = new URLSearchParams();
  if (driverId) params.append('driver_id', String(driverId));
  if (periodType) params.append('period_type', String(periodType));
  if (limit) params.append('limit', String(limit));
  if (excludeCurrent) params.append('exclude_current', '1');

  const url = `${EARNINGS_API_BASE_URL}history?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const token = await getAccessToken().catch(() => null);
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Return empty list gracefully
      return { success: true, data: { items: [] } };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    // Fail soft with empty items so the UI can show a fallback message
    return { success: true, data: { items: [] } };
  }
}




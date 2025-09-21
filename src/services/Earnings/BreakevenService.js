// services/Earnings/BreakevenService.js
import { getAccessToken } from '../authService';
import { apiBaseUrl } from '../networkConfig';

const EARNINGS_API_BASE_URL = `${apiBaseUrl()}/breakeven/`;

/**
 * GET /breakeven/?driver_id=&period=&expenses=
 * period: "today" | "week" | "month"
 */
export async function getBreakeven({ driverId, period = 'today', expenses = 0 }) {
  const params = new URLSearchParams();
  if (driverId) params.append('driver_id', String(driverId));
  if (period) params.append('period', String(period));
  if (typeof expenses === 'number') params.append('expenses', String(expenses));
  else params.append('expenses', '0');

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

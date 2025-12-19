// utils/timezone.js
const PH_OFFSET_HOURS = 8;

/**
 * Get current Philippines time as Date object
 */
export function getPhilippinesTime() {
  const now = new Date();
  return new Date(now.getTime() + (PH_OFFSET_HOURS * 60 * 60 * 1000));
}

/**
 * Convert any date to Philippines timezone and format as YYYY-MM-DD
 */
export function toPhilippinesYMD(date = new Date()) {
  const phTime = new Date(date.getTime() + (PH_OFFSET_HOURS * 60 * 60 * 1000));
  const y = phTime.getUTCFullYear();
  const m = String(phTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(phTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get Philippines date window for today (start and end in UTC ISO)
 */
export function getPhTodayUtcWindow() {
  const nowUtc = Date.now();
  const nowPh = new Date(nowUtc + PH_OFFSET_HOURS * 3600_000);
  const y = nowPh.getUTCFullYear();
  const m = nowPh.getUTCMonth();
  const d = nowPh.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - PH_OFFSET_HOURS * 3600_000;
  const endUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0) - PH_OFFSET_HOURS * 3600_000;
  return [new Date(startUtcMs).toISOString(), new Date(endUtcMs).toISOString()];
}

/**
 * Convert Philippines date string (YYYY-MM-DD) to UTC ISO for database storage
 */
export function phDateToUtcIso(phDateString) {
  const [year, month, day] = phDateString.split('-').map(Number);
  const phDate = new Date(year, month - 1, day, 0, 0, 0);
  const utcDate = new Date(phDate.getTime() - (PH_OFFSET_HOURS * 60 * 60 * 1000));
  return utcDate.toISOString();
}

/**
 * Convert UTC ISO to Philippines date string (YYYY-MM-DD)
 */
export function utcIsoToPhDate(utcIso) {
  const utcDate = new Date(utcIso);
  const phDate = new Date(utcDate.getTime() + (PH_OFFSET_HOURS * 60 * 60 * 1000));
  return toPhilippinesYMD(phDate);
}
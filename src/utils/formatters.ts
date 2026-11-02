// src/utils/formatters.ts
import { LOCALE, TIME_ZONE } from './constants';
import { normalizePhoneNumber } from './validators';

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 5 Nov 2026 (or 5 November 2026 with style "long"). Returns "—" for missing/invalid dates. */
export function formatDate(value: DateInput, style: 'short' | 'long' = 'short'): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString(LOCALE, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

/** 14:30 */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** 5 Nov 2026, 14:30 */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${formatDate(d)}, ${formatTime(d)}`;
}

export function formatFullName(first?: string | null, last?: string | null): string {
  return [first, last].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
}

export function getInitials(first?: string | null, last?: string | null): string {
  const initials = [first, last]
    .map((p) => (p ?? '').trim().charAt(0).toUpperCase())
    .join('');
  return initials || '?';
}

/** "mary jane" -> "Mary Jane" */
export function toTitleCase(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** "no_show" / "no-show" -> "No show" */
export function formatStatus(status?: string | null): string {
  const text = (status ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
}

/** 0821234567 or +27821234567 -> "082 123 4567". Unrecognised input is returned unchanged. */
export function formatPhoneNumber(value?: string | null): string {
  const local = normalizePhoneNumber(value);
  if (!local) return (value ?? '').trim() || '—';
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** 8001015009087 -> "800101 •••• •• 7" so the full ID isn't shown on screen. */
export function maskIdNumber(value?: string | null): string {
  const id = (value ?? '').trim();
  if (!/^\d{13}$/.test(id)) return id || '—';
  return `${id.slice(0, 6)} •••• •• ${id.slice(12)}`;
}

/** 0.4 -> "400 m", 3.26 -> "3.3 km" */
export function formatDistance(km?: number | null): string {
  if (km === null || km === undefined || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
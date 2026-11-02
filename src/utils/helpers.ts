// src/utils/helpers.ts
import { Linking } from 'react-native';
import { notify } from './dialogs';

/** Best-effort readable message from anything that can be thrown. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'string') return error || fallback;
  if (error && typeof error === 'object') {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

async function openLink(url: string, failureMessage: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    notify('Unable to open', failureMessage);
  }
}

export const callPhoneNumber = (number: string) =>
  openLink(`tel:${number.replace(/\s/g, '')}`, 'This device cannot place calls.');

export const sendEmail = (address: string) =>
  openLink(`mailto:${address.trim()}`, 'No email app is available.');

export type LocationLike =
  | string
  | { latitude?: number | string | null; longitude?: number | string | null; address?: string | null }
  | null
  | undefined;

/** Google Maps link for coordinates, an address, or free text. Null when there is nothing to show. */
export function buildMapsUrl(loc: LocationLike): string | null {
  if (!loc) return null;
  const base = 'https://www.google.com/maps/search/?api=1&query=';
  if (typeof loc === 'string') return loc.trim() ? `${base}${encodeURIComponent(loc.trim())}` : null;
  if (loc.latitude != null && loc.longitude != null) return `${base}${loc.latitude},${loc.longitude}`;
  if (loc.address) return `${base}${encodeURIComponent(loc.address)}`;
  return null;
}

export async function openInMaps(loc: LocationLike): Promise<void> {
  const url = buildMapsUrl(loc);
  if (!url) {
    notify('No location', 'There is no location available to show on the map.');
    return;
  }
  await openLink(url, 'No maps app is available.');
}

/** Readable text for a stored location: address first, then coordinates. */
export function describeLocation(loc: LocationLike, fallback = 'Location not provided'): string {
  if (!loc) return fallback;
  if (typeof loc === 'string') return loc.trim() || fallback;
  if (loc.address) return loc.address;
  if (loc.latitude != null && loc.longitude != null) {
    return `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`;
  }
  return fallback;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function groupBy<T>(items: readonly T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[key(item)] ||= []).push(item);
    return acc;
  }, {});
}
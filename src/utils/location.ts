import { Platform, Share } from 'react-native';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Approximate Cape Town coordinates, used when device location is unavailable. */
export const CAPE_TOWN_COORDINATES: Coordinates = {
  latitude: -33.9249,
  longitude: 18.4241,
};

/**
 * Get the device's current location.
 * Returns null if permission is denied or location cannot be retrieved.
 */
export async function getUserLocation(): Promise<Coordinates | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    console.warn('Could not get device location:', error);
    return null;
  }
}

/**
 * Get the device's current location, falling back to Cape Town coordinates.
 */
export async function getBestLocation(): Promise<Coordinates> {
  return (await getUserLocation()) ?? CAPE_TOWN_COORDINATES;
}

/**
 * Calculate the distance in kilometers between two latitude/longitude points.
 */
export function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(latitude2 - latitude1);
  const longitudeDifference = toRadians(longitude2 - longitude1);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/**
 * "Download" a plain-text document.
 * - Web: saves a .txt file through the browser.
 * - iOS/Android: opens the system share sheet.
 */
export async function shareOrDownloadText(
  filename: string,
  text: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const g = globalThis as any;
    const blob = new g.Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = g.URL.createObjectURL(blob);
    const anchor = g.document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    g.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    g.URL.revokeObjectURL(url);
    return;
  }

  await Share.share({ title: filename, message: text });
}

/**
 * Generate a PDF from HTML and let the user download or share it.
 * Works on iOS, Android, and web.
 */
export async function shareOrDownloadPdf(
  filename: string,
  html: string
): Promise<void> {
  const pdfName = filename.toLowerCase().endsWith('.pdf')
    ? filename
    : `${filename}.pdf`;

  if (Platform.OS === 'web') {
    const { uri } = await Print.printToFileAsync({ html });
    const g = globalThis as any;
    const response = await fetch(uri);
    const blob = await response.blob();
    const url = g.URL.createObjectURL(blob);
    const anchor = g.document.createElement('a');

    anchor.href = url;
    anchor.download = pdfName;
    g.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    g.URL.revokeObjectURL(url);
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save or share prescription',
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Share.share({ title: pdfName, url: uri });
  }
}
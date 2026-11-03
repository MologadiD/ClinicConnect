import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * "Download" a plain-text document.
 *  - web: saves a .txt file through the browser
 *  - iOS/Android: opens the system share sheet (save to Files, WhatsApp, email, print...)
 */
export async function shareOrDownloadText(filename: string, text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const g = globalThis as any;
    const blob = new g.Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = g.URL.createObjectURL(blob);
    const a = g.document.createElement('a');
    a.href = url;
    a.download = filename;
    g.document.body.appendChild(a);
    a.click();
    a.remove();
    g.URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: text });
}

/**
 * Generate a PDF from HTML and let the user download / share it.
 * Works on iOS, Android and web.
 */
export async function shareOrDownloadPdf(filename: string, html: string): Promise<void> {
  // Ensure the filename ends with .pdf
  const pdfName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  if (Platform.OS === 'web') {
    // On web, expo-print can still produce a data URI we can force-download
    const { uri } = await Print.printToFileAsync({ html });
    const g = globalThis as any;

    // Fetch the generated file and turn it into a Blob download
    const response = await fetch(uri);
    const blob = await response.blob();
    const url = g.URL.createObjectURL(blob);
    const a = g.document.createElement('a');
    a.href = url;
    a.download = pdfName;
    g.document.body.appendChild(a);
    a.click();
    a.remove();
    g.URL.revokeObjectURL(url);
    return;
  }

  // Native: write PDF then open the system share sheet
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
    // Extremely rare fallback
    await Share.share({ title: pdfName, url: uri });
  }
}

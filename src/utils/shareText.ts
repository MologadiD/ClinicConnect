import { Platform, Share } from 'react-native';

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

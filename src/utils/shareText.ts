import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';


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


export async function shareOrDownloadPdf(filename: string, html: string): Promise<void> {
  const pdfName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  let Print: any;
  let Sharing: any;
  try {
    Print = require('expo-print');
    Sharing = require('expo-sharing');
  } catch {
    throw new Error(
      'PDF libraries not installed. Run:\n\nnpx expo install expo-print expo-sharing\n\nThen restart the app with:\nnpx expo start -c'
    );
  }

  const printToFile =
    Print.printToFileAsync ||
    (Print.default && Print.default.printToFileAsync);

  if (typeof printToFile !== 'function') {
    throw new Error(
      'expo-print is installed but printToFileAsync is missing.\n\nStop the app and run:\nnpx expo install expo-print expo-sharing\nnpx expo start -c'
    );
  }

  // 1. Generate the PDF
  //    Ask for base64 too: on Android (Expo Go) the file expo-print writes
  //    is outside the app sandbox and cannot be read back by FileSystem.
  const { uri: tempUri, base64: printedBase64 } = await printToFile({
    html,
    base64: Platform.OS !== 'web',
  });

  if (Platform.OS === 'web') {
    const g = globalThis as any;
    try {
      const response = await fetch(tempUri);
      const blob = await response.blob();
      const url = g.URL.createObjectURL(blob);
      const a = g.document.createElement('a');
      a.href = url;
      a.download = pdfName;
      g.document.body.appendChild(a);
      a.click();
      a.remove();
      g.URL.revokeObjectURL(url);
    } catch {
      g.window.open(tempUri, '_blank');
    }
    return;
  }

  // 2. Move the PDF into a normal cache path that Android can share.
  //    expo-print writes under cache/Print/ which is often unreadable to
  //    Sharing / copyAsync on Android (especially Expo Go).
  //    Reading as base64 + rewriting is the most reliable workaround.
  // Sanitise the name: spaces, slashes, colons etc. produce an invalid
  // file:// URI, which expo-sharing then reports as "Not allowed to read
  // file under given URL".
  const safeName = pdfName
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'document.pdf';

  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('No writable directory available to store the PDF.');
  }
  const shareableUri = `${baseDir}${safeName}`;

  await FileSystem.deleteAsync(shareableUri, { idempotent: true });

  // Always read the generated file and write a fresh copy in our own
  // cache dir (an app-owned location expo-sharing is allowed to read).
  const base64: string =
    printedBase64 ||
    (await FileSystem.readAsStringAsync(tempUri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
  await FileSystem.writeAsStringAsync(shareableUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const written = await FileSystem.getInfoAsync(shareableUri);
  if (!written.exists) {
    throw new Error('Could not save the PDF before sharing.');
  }
  const finalUri = shareableUri;

  // 3. Open the system share sheet
  const isAvailableFn =
    Sharing.isAvailableAsync ||
    (Sharing.default && Sharing.default.isAvailableAsync);
  const shareAsyncFn =
    Sharing.shareAsync || (Sharing.default && Sharing.default.shareAsync);

  const canShare = typeof isAvailableFn === 'function' ? await isAvailableFn() : false;

  if (canShare && typeof shareAsyncFn === 'function') {
    await shareAsyncFn(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save or share prescription',
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Share.share({ title: pdfName, url: finalUri });
  }
}
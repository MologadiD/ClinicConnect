import { Alert, Platform } from 'react-native';

/**
 * react-native-web does not implement Alert.alert, so on web we fall back to
 * the browser's own dialogs. On iOS/Android the native Alert is used.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const w = (globalThis as any).window;
    if (w?.alert) w.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Resolves true if the user confirms, false if they cancel or dismiss. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Yes'
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const w = (globalThis as any).window;
    return Promise.resolve(!!w?.confirm?.(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'No', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

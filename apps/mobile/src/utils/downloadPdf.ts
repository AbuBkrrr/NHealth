import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../api/client';

/**
 * Downloads a PDF from an authenticated backend endpoint and hands it to the
 * OS share sheet (so the person can save it, print it, or send it on).
 * @param path a path relative to the API base, e.g. "/payments/abc123/receipt.pdf"
 * @param filename the name to save the file as locally
 */
export async function downloadAndSharePdf(path: string, filename: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('token');
    const url = `${API_BASE_URL}${path}`;
    const fileUri = FileSystem.documentDirectory + filename;

    const result = await FileSystem.downloadAsync(url, fileUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (result.status !== 200) {
      Alert.alert('Download failed', "Couldn't download this file. Please try again.");
      return;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: filename });
    } else {
      Alert.alert('Downloaded', `Saved to ${result.uri}`);
    }
  } catch {
    Alert.alert('Download failed', "Couldn't download this file. Please check your connection and try again.");
  }
}

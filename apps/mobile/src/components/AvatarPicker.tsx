import React, { useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { accountApi } from '../api/account';
import { getErrorMessage } from '../utils/errorMessage';

interface AvatarPickerProps {
  name: string;
  avatarUrl?: string | null;
  color: string;
  onUploaded: (avatarUrl: string) => void;
}

/** Tappable avatar circle: shows the current photo or the user's initial, and
 * lets them pick a new photo from their library which is uploaded immediately. */
export function AvatarPicker({ name, avatarUrl, color, onUploaded }: AvatarPickerProps) {
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const { avatarUrl: newUrl } = await accountApi.uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg');
      onUploaded(newUrl);
    } catch (err: any) {
      Alert.alert('Could not update photo', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Pressable onPress={pickAndUpload} disabled={uploading}>
      <View style={[styles.avatarWrap, { backgroundColor: color + '22' }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.avatarText, { color }]}>{name.charAt(0).toUpperCase()}</Text>
        )}
        {uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
      <View style={[styles.editBadge, { backgroundColor: color }]}>
        <Text style={styles.editBadgeText}>✎</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 36, fontWeight: '800' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

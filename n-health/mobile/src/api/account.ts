import { api } from './client';

export const accountApi = {
  /** Uploads a new profile photo from a local file URI (e.g. from expo-image-picker). */
  uploadAvatar: (localUri: string, mimeType: string) => {
    const filename = localUri.split('/').pop() ?? `avatar.${mimeType.split('/')[1] ?? 'jpg'}`;
    const form = new FormData();
    // React Native's FormData accepts this { uri, name, type } shape for files.
    form.append('avatar', { uri: localUri, name: filename, type: mimeType } as any);
    return api
      .post<{ id: string; avatarUrl: string }>('/account/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /** Updates the shared account fields (name/phone) that live on the User table. */
  updateAccount: (data: { name?: string; phone?: string }) =>
    api.patch<{ id: string; name: string; phone?: string }>('/account', data).then((r) => r.data),
};

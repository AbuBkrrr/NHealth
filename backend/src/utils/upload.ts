/**
 * File upload validation and configuration
 * Handles avatar and other file uploads with security checks
 */

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate uploaded file before storage
 */
export function validateUploadedFile(
  originalname: string,
  mimetype: string,
  size: number
): FileValidationResult {
  // Check file size
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  // Check file extension
  const ext = originalname.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File extension not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename for secure storage
 */
export function sanitizeFilename(filename: string, userId: string): string {
  const ext = filename.split('.').pop();
  const timestamp = Date.now();
  // Format: userId-timestamp.ext (prevents directory traversal and collisions)
  return `avatar-${userId}-${timestamp}.${ext}`;
}

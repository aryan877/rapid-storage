/**
 * Safe limits configuration for file operations
 * These values are set to ensure optimal performance and user experience
 */

export const SAFE_LIMITS = {
  // File upload limits
  MAX_FILES_PER_UPLOAD: 100,
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB per file
  MAX_TOTAL_SIZE_PER_UPLOAD: 10 * 1024 * 1024 * 1024, // 10GB total per upload session

  // File type limits
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ],

  // System limits
  MAX_IMAGE_PICKER_SELECTION: 50, // iOS/Android system limit for image picker
  MAX_SHARE_INTENT_FILES: 100, // Maximum files from share intent (matches NSExtensionActivationSupportsFileWithMaxCount)
  MAX_SHARE_INTENT_IMAGES: 50, // Maximum images from share intent (matches NSExtensionActivationSupportsImageWithMaxCount)
  MAX_SHARE_INTENT_VIDEOS: 20, // Maximum videos from share intent (matches NSExtensionActivationSupportsMovieWithMaxCount)
  MAX_SHARE_INTENT_URLS: 1, // Maximum URLs from share intent (matches NSExtensionActivationSupportsWebURLWithMaxCount)
  MAX_SHARE_INTENT_TEXT: 1, // Maximum text items from share intent (matches NSExtensionActivationSupportsTextWithMaxCount)

  // UI limits
  MAX_FILES_PER_PAGE: 50,
  MAX_FOLDER_NAME_LENGTH: 255,
  MAX_FILE_NAME_LENGTH: 255,

  // Performance limits
  MAX_CONCURRENT_UPLOADS: 3,
  UPLOAD_TIMEOUT: 300000, // 5 minutes in milliseconds
  DOWNLOAD_TIMEOUT: 300000, // 5 minutes in milliseconds

  // Cache limits
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

// Helper functions to check limits
export const isFileSizeValid = (size: number): boolean => {
  return size > 0 && size <= SAFE_LIMITS.MAX_FILE_SIZE;
};

export const isFileTypeAllowed = (mimeType: string): boolean => {
  const allAllowedTypes = [
    ...SAFE_LIMITS.ALLOWED_IMAGE_TYPES,
    ...SAFE_LIMITS.ALLOWED_VIDEO_TYPES,
    ...SAFE_LIMITS.ALLOWED_DOCUMENT_TYPES,
  ];
  return (
    allAllowedTypes.includes(mimeType) ||
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/')
  );
};

export const isFileNameValid = (name: string): boolean => {
  return name.length > 0 && name.length <= SAFE_LIMITS.MAX_FILE_NAME_LENGTH;
};

export const isFolderNameValid = (name: string): boolean => {
  return name.length > 0 && name.length <= SAFE_LIMITS.MAX_FOLDER_NAME_LENGTH;
};

export const getTotalUploadSize = (files: Array<{ size: number }>): number => {
  return files.reduce((total, file) => total + file.size, 0);
};

export const isUploadSizeValid = (files: Array<{ size: number }>): boolean => {
  const totalSize = getTotalUploadSize(files);
  return totalSize <= SAFE_LIMITS.MAX_TOTAL_SIZE_PER_UPLOAD;
};

export const getFileTypeCategory = (mimeType: string): 'image' | 'video' | 'document' | 'other' => {
  if (SAFE_LIMITS.ALLOWED_IMAGE_TYPES.includes(mimeType) || mimeType.startsWith('image/')) {
    return 'image';
  }
  if (SAFE_LIMITS.ALLOWED_VIDEO_TYPES.includes(mimeType) || mimeType.startsWith('video/')) {
    return 'video';
  }
  if (SAFE_LIMITS.ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return 'document';
  }
  return 'other';
};

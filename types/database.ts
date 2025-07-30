import { Tables } from './supabase';

export type Folder = Tables<'folders'> & { type: 'folder' };
export type File = Tables<'files'> & { type: 'file' };

export interface FileWithFolder extends File {
  folder?: Folder;
}

export interface FolderWithContents extends Folder {
  files: File[];
  subfolders: Folder[];
}

export type FileIconType =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'pdf'
  | 'spreadsheet'
  | 'presentation'
  | 'text'
  | 'unknown';

export const getFileIcon = (mimeType?: string): FileIconType => {
  if (!mimeType) return 'unknown';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.startsWith('text/') || mimeType.includes('plain')) return 'text';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar'))
    return 'archive';
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml'))
    return 'code';

  return 'document';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isImageFile = (mimeType?: string): boolean => {
  return mimeType?.startsWith('image/') ?? false;
};

export const isVideoFile = (mimeType?: string): boolean => {
  return mimeType?.startsWith('video/') ?? false;
};

export const isAudioFile = (mimeType?: string): boolean => {
  return mimeType?.startsWith('audio/') ?? false;
};

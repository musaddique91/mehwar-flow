'use client';

import type { MediaDto } from '@mehwar/shared';
import { api, ApiError } from './api';

/**
 * Uploads a file straight to storage: create the asset, PUT to the presigned URL (XHR for
 * progress), then tell the API it's done so the worker can process it.
 */
export function inferMimeType(file: { name: string; type?: string }): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return file.type || 'application/octet-stream';
  }
}

/**
 * Uploads a file straight to storage: create the asset, PUT to the presigned URL (XHR for
 * progress), then tell the API it's done so the worker can process it.
 */
export async function uploadMedia(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<MediaDto> {
  const mimeType = inferMimeType(file);
  const { media, uploadUrl } = await api<{ media: MediaDto; uploadUrl: string }>('/media/uploads', {
    method: 'POST',
    json: {
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
    },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'Upload failed'));
    xhr.onerror = () =>
      reject(new ApiError(0, 'Upload failed: check your connection or the storage CORS settings'));
    xhr.send(file);
  });
  return api<MediaDto>(`/media/${media.id}/complete`, { method: 'POST' });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

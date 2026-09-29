'use client';

import type { MediaDto } from '@mehwar/shared';
import { api, ApiError } from './api';

/**
 * Uploads a file straight to storage: create the asset, PUT to the presigned URL (XHR for
 * progress), then tell the API it's done so the worker can process it.
 */
export async function uploadMedia(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<MediaDto> {
  const { media, uploadUrl } = await api<{ media: MediaDto; uploadUrl: string }>('/media/uploads', {
    method: 'POST',
    json: {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
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

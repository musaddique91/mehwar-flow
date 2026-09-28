import type { MediaAsset } from '@mehwar/db';
import type { MediaDto } from '@mehwar/shared';
import type { Storage } from '@mehwar/storage';

export async function toMediaDto(m: MediaAsset, storage: Storage | null): Promise<MediaDto> {
  const url =
    storage && m.status === 'READY'
      ? m.publicKey
        ? storage.publicUrl(m.publicKey)
        : await storage.presignGet(m.storageKey)
      : null;
  const thumbnailUrl = storage && m.thumbnailKey ? await storage.presignGet(m.thumbnailKey) : null;
  return {
    id: m.id,
    fileName: m.fileName,
    mimeType: m.mimeType,
    kind: m.mimeType.startsWith('video/') ? 'video' : 'image',
    sizeBytes: Number(m.sizeBytes),
    width: m.width,
    height: m.height,
    durationSec: m.durationSec,
    status: m.status,
    url,
    thumbnailUrl: thumbnailUrl ?? (m.mimeType.startsWith('image/') ? url : null),
    processingError: m.processingError,
    createdAt: m.createdAt.toISOString(),
  };
}

import type { Channel, MediaAsset, Post, PostMedia, PostTarget } from '@mehwar/db';
import type { PostDto, TargetOptions } from '@mehwar/shared';
import type { Storage } from '@mehwar/storage';
import { toMediaDto } from '../media/media.mapper';

export type PostWithRelations = Post & {
  targets: (PostTarget & { channel: Channel })[];
  media: (PostMedia & { media: MediaAsset })[];
};

export const postInclude = {
  targets: { include: { channel: true }, orderBy: { createdAt: 'asc' as const } },
  media: { include: { media: true }, orderBy: { position: 'asc' as const } },
};

export async function toPostDto(p: PostWithRelations, storage: Storage | null): Promise<PostDto> {
  return {
    id: p.id,
    text: p.text,
    firstComment: p.firstComment,
    status: p.status,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    timezone: p.timezone,
    media: await Promise.all(p.media.map((m) => toMediaDto(m.media, storage))),
    targets: p.targets.map((t) => ({
      id: t.id,
      channelId: t.channelId,
      platform: t.channel.platform,
      channelName: t.channel.displayName,
      textOverride: t.textOverride,
      options: (t.options ?? {}) as TargetOptions,
      status: t.status,
      externalUrl: t.externalUrl,
      lastError: t.lastError,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

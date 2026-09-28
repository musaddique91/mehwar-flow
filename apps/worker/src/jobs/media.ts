import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { forTenant } from '@mehwar/db';
import type { MediaJob } from '@mehwar/shared';
import { storageKeys } from '@mehwar/storage';
import type { WorkerDeps } from '../deps';

const exec = promisify(execFile);

export interface MediaTools {
  ffprobePath: string;
  ffmpegPath: string;
}

interface VideoProbe {
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

async function probeVideo(tools: MediaTools, url: string): Promise<VideoProbe> {
  const { stdout } = await exec(
    tools.ffprobePath,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height:stream_tags=rotate:stream_side_data=rotation:format=duration',
      '-of',
      'json',
      url,
    ],
    { timeout: 120_000 },
  );
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  const rotation = Math.abs(
    Number(stream.tags?.rotate ?? stream.side_data_list?.[0]?.rotation ?? 0),
  );
  const swap = rotation === 90 || rotation === 270;
  return {
    width: (swap ? stream.height : stream.width) ?? null,
    height: (swap ? stream.width : stream.height) ?? null,
    durationSec: data.format?.duration ? Number(data.format.duration) : null,
  };
}

async function videoPoster(
  tools: MediaTools,
  url: string,
  durationSec: number | null,
): Promise<Buffer> {
  const at = durationSec && durationSec > 2 ? 1 : 0;
  const { stdout } = await exec(
    tools.ffmpegPath,
    [
      '-v',
      'error',
      '-ss',
      String(at),
      '-i',
      url,
      '-frames:v',
      '1',
      '-vf',
      'scale=480:-2',
      '-f',
      'image2',
      '-c:v',
      'mjpeg',
      'pipe:1',
    ],
    { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024, timeout: 120_000 },
  );
  return stdout as unknown as Buffer;
}

/**
 * Extracts metadata, makes a thumbnail, and writes the public copy that pull-based platforms fetch:
 * images are normalized to JPEG (Instagram only accepts JPEG); videos are copied server-side.
 */
export async function processMedia(
  deps: WorkerDeps,
  tools: MediaTools,
  job: MediaJob,
): Promise<void> {
  const { storage } = deps;
  if (!storage) throw new Error('Storage is not configured');
  const db = forTenant(deps.prisma, job.organizationId);
  const media = await db.mediaAsset.findUnique({ where: { id: job.mediaId } });
  if (!media || media.status === 'READY') return;

  try {
    if (media.mimeType.startsWith('image/')) {
      const original = await storage.getBuffer(media.storageKey);
      const image = sharp(original, { failOn: 'error', animated: false }).rotate();
      const meta = await image.metadata();
      const jpeg = await image
        .clone()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      const thumb = await sharp(jpeg)
        .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const publicKey = storageKeys.public(job.organizationId, media.id, 'jpg');
      const thumbnailKey = storageKeys.thumbnail(job.organizationId, media.id);
      await storage.put(publicKey, jpeg, 'image/jpeg');
      await storage.put(thumbnailKey, thumb, 'image/jpeg');
      const oriented = (meta.orientation ?? 1) >= 5;
      await db.mediaAsset.update({
        where: { id: media.id },
        data: {
          status: 'READY',
          width: (oriented ? meta.height : meta.width) ?? null,
          height: (oriented ? meta.width : meta.height) ?? null,
          publicKey,
          thumbnailKey,
          processingError: null,
        },
      });
    } else if (media.mimeType.startsWith('video/')) {
      const url = await storage.presignGet(media.storageKey, 3600);
      const probe = await probeVideo(tools, url);
      const ext = media.fileName.split('.').pop()?.toLowerCase() || 'mp4';
      const publicKey = storageKeys.public(job.organizationId, media.id, ext);
      await storage.copy(media.storageKey, publicKey, media.mimeType);
      let thumbnailKey: string | null = null;
      try {
        const poster = await videoPoster(tools, url, probe.durationSec);
        if (poster.length > 0) {
          thumbnailKey = storageKeys.thumbnail(job.organizationId, media.id);
          await storage.put(thumbnailKey, poster, 'image/jpeg');
        }
      } catch (err) {
        deps.log('poster frame failed', { mediaId: media.id, message: (err as Error).message });
      }
      await db.mediaAsset.update({
        where: { id: media.id },
        data: { status: 'READY', ...probe, publicKey, thumbnailKey, processingError: null },
      });
    } else {
      throw new Error(`Unsupported media type ${media.mimeType}`);
    }
  } catch (err) {
    const message = (err as Error).message;
    await db.mediaAsset.update({
      where: { id: media.id },
      data: {
        status: 'FAILED',
        processingError: `Could not process this file: ${message}`.slice(0, 1000),
      },
    });
    deps.log('media processing failed', { mediaId: media.id, message });
  }
  await deps.notifier.event(job.organizationId, { type: 'media.updated', mediaId: media.id });
}

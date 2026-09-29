import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';

export interface StorageConfig {
  /** Endpoint the server uses (inside docker: http://minio:9000). */
  endpoint: string;
  /** Endpoint browsers and social platforms use (e.g. https://media.example.com). */
  publicUrl: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function storageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig | null {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) return null;
  return {
    endpoint: env.S3_ENDPOINT,
    publicUrl: (env.S3_PUBLIC_URL ?? env.S3_ENDPOINT).replace(/\/$/, ''),
    region: env.S3_REGION ?? 'us-east-1',
    bucket: env.S3_BUCKET ?? 'mehwar-media',
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  };
}

/** Object keys are always namespaced by organization, so tenants never share a prefix. */
export const storageKeys = {
  original: (orgId: string, mediaId: string, fileName: string) =>
    `org/${orgId}/media/${mediaId}/${sanitize(fileName)}`,
  thumbnail: (orgId: string, mediaId: string) => `org/${orgId}/media/${mediaId}/thumb.jpg`,
  /** Under `public/`: anonymously readable so Instagram/Threads/TikTok can pull it. */
  public: (orgId: string, mediaId: string, ext: string) =>
    `public/${orgId}/${mediaId}/${cryptoRandom()}.${ext}`,
};

function sanitize(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .slice(-120) || 'file'
  );
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export class Storage {
  private readonly internal: S3Client;
  /** Signs URLs against the public endpoint so browsers can use them directly. */
  private readonly signer: S3Client;

  constructor(readonly config: StorageConfig) {
    const base = {
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    };
    this.internal = new S3Client({ ...base, endpoint: config.endpoint });
    this.signer = new S3Client({ ...base, endpoint: config.publicUrl });
  }

  presignPut(key: string, contentType: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: contentType }),
      {
        expiresIn,
      },
    );
  }

  presignGet(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      { expiresIn },
    );
  }

  /** Presigned GET against the internal endpoint, for server-side tools like ffprobe. */
  presignGetInternal(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.internal,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      {
        expiresIn,
      },
    );
  }

  /** Permanent URL of an object under `public/`. */
  publicUrl(key: string): string {
    return `${this.config.publicUrl}/${this.config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.internal.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType };
    } catch (err) {
      if (
        (err as { name?: string }).name === 'NotFound' ||
        (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async getStream(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const res = await this.internal.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    return res.Body as Readable;
  }

  async getBuffer(key: string, range?: { start: number; end: number }): Promise<Buffer> {
    const stream = await this.getStream(key, range);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.internal.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /** Server-side copy: large videos never pass through our memory. */
  async copy(sourceKey: string, destKey: string, contentType?: string): Promise<void> {
    await this.internal.send(
      new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
        Key: destKey,
        ...(contentType ? { ContentType: contentType, MetadataDirective: 'REPLACE' as const } : {}),
      }),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    const objects = keys.filter(Boolean).map((Key) => ({ Key }));
    if (objects.length === 0) return;
    await this.internal.send(
      new DeleteObjectsCommand({ Bucket: this.config.bucket, Delete: { Objects: objects } }),
    );
  }
}

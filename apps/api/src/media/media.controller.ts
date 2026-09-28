import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { mediaUploadSchema, type MediaDto } from '@mehwar/shared';
import { storageKeys, type Storage } from '@mehwar/storage';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { EntitlementsService } from '../billing/entitlements.service';
import { ZodPipe } from '../common/zod.pipe';
import { QueuesService } from '../infra/queues.service';
import { STORAGE } from '../infra/tokens';
import { PrismaService } from '../prisma/prisma.service';
import { toMediaDto } from './media.mapper';

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
    private readonly entitlements: EntitlementsService,
    @Inject(STORAGE) private readonly storage: Storage | null,
  ) {}

  private requireStorage(): Storage {
    if (!this.storage)
      throw new ServiceUnavailableException('Media storage is not configured (S3_* settings)');
    return this.storage;
  }

  @Get()
  async list(@CurrentAuth() auth: AuthContext): Promise<MediaDto[]> {
    const items = await this.prisma.tenant(auth.organizationId).mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(items.map((m) => toMediaDto(m, this.storage)));
  }

  /** Step 1: create the asset and return a presigned PUT the browser uploads to directly. */
  @Post('uploads')
  async createUpload(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(mediaUploadSchema)) body: z.infer<typeof mediaUploadSchema>,
  ) {
    const storage = this.requireStorage();
    if (body.mimeType.startsWith('image/') && body.sizeBytes > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Images must be 30 MB or smaller');
    }
    await this.entitlements.assertWithin(auth.organizationId, 'storageBytes', body.sizeBytes);
    const id = randomUUID();
    const key = storageKeys.original(auth.organizationId, id, body.fileName);
    const media = await this.prisma.tenant(auth.organizationId).mediaAsset.create({
      data: {
        id,
        organizationId: auth.organizationId,
        storageKey: key,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: BigInt(body.sizeBytes),
      },
    });
    return {
      media: await toMediaDto(media, storage),
      uploadUrl: await storage.presignPut(key, body.mimeType),
    };
  }

  /** Step 2: the browser finished uploading; verify and hand over to the media worker. */
  @Post(':id/complete')
  async complete(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaDto> {
    const storage = this.requireStorage();
    const db = this.prisma.tenant(auth.organizationId);
    const media = await db.mediaAsset.findUnique({ where: { id } });
    if (!media) throw new NotFoundException();
    const head = await storage.head(media.storageKey);
    if (!head)
      throw new BadRequestException('Upload not found in storage; please retry the upload');
    const updated = await db.mediaAsset.update({
      where: { id },
      data: { status: 'PROCESSING', sizeBytes: BigInt(head.size) },
    });
    await this.queues.media.add(
      'process',
      { organizationId: auth.organizationId, mediaId: id },
      { jobId: id, attempts: 3 },
    );
    return toMediaDto(updated, storage);
  }

  @Get(':id')
  async get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaDto> {
    const media = await this.prisma
      .tenant(auth.organizationId)
      .mediaAsset.findUnique({ where: { id } });
    if (!media) throw new NotFoundException();
    return toMediaDto(media, this.storage);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const db = this.prisma.tenant(auth.organizationId);
    const media = await db.mediaAsset.findUnique({
      where: { id },
      include: { posts: { select: { postId: true } } },
    });
    if (!media) throw new NotFoundException();
    if (media.posts.length > 0)
      throw new BadRequestException('This media is used by a post; remove it from the post first');
    await db.mediaAsset.delete({ where: { id } });
    await this.storage
      ?.deleteMany([media.storageKey, media.thumbnailKey ?? '', media.publicKey ?? ''])
      .catch(() => undefined);
  }
}

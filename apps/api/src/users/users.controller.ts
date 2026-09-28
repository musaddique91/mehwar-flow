import {
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { hashPassword, verifyPassword } from '@mehwar/crypto';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UserDto,
} from '@mehwar/shared';
import { AuthService } from '../auth/auth.service';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @Patch()
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<UserDto> {
    const user = await this.prisma.user.update({ where: { id: auth.userId }, data: body });
    return this.auth.toDto(user);
  }

  /** Changing the password signs out every other session. */
  @HttpCode(204)
  @Post('password')
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    await this.auth.revokeAllSessions(user.id);
    await this.auth.audit(auth.organizationId, user.id, 'user.password_changed', req.ip);
  }
}

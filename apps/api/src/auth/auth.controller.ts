import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  loginSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
  type UserDto,
} from '@mehwar/shared';
import { APP_CONFIG, type AppConfig } from '../config';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthService, type ClientInfo, type IssuedTokens } from './auth.service';
import type { AuthContext } from './auth.types';
import { CurrentAuth, Public } from './decorators';

export const REFRESH_COOKIE = 'mf_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('register')
  async register(
    @Body(new ZodPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(body, clientInfo(req)), req);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body, clientInfo(req)), req);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Missing refresh token');
    try {
      return this.respond(res, await this.auth.refresh(token, clientInfo(req)), req);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, { path: this.config.REFRESH_COOKIE_PATH });
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.clearCookie(REFRESH_COOKIE, { path: this.config.REFRESH_COOKIE_PATH });
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) throw new UnauthorizedException();
    return this.auth.toDto(user);
  }

  private respond(res: Response, tokens: IssuedTokens, req?: Request): AuthResponse {
    const isHttps = req ? Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
    const secure = this.config.COOKIE_SECURE !== undefined ? (this.config.cookieSecure && isHttps) : isHttps;
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: this.config.REFRESH_COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, user: tokens.user };
  }
}

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

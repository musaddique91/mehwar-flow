import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from './auth.types';

export const IS_PUBLIC = 'isPublic';
/** Marks a route as reachable without an access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    if (!req.auth) throw new Error('CurrentAuth used on a public route');
    return req.auth;
  },
);

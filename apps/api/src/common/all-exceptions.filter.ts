import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@mehwar/db';

/**
 * Returns clean JSON errors and logs every unexpected (5xx) error with its stack and request id,
 * so "500 Internal Server Error" is always diagnosable from `docker compose logs api`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (status >= 500)
        this.logger.error(
          `${req.method} ${req.originalUrl} -> ${status} [${req.id}]`,
          exception.stack,
        );
      res
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2025') {
      res.status(404).json({ statusCode: 404, message: 'Not found' });
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `${req.method} ${req.originalUrl} -> 500 [${req.id}] ${err.message}`,
      err.stack,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Something went wrong on our side. Please try again.',
      requestId: req.id,
    });
  }
}

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Reads a numeric status off a non-HttpException error (e.g. body-parser 413). */
function statusFromUnknown(exception: unknown): number | null {
  if (exception && typeof exception === 'object') {
    const maybe = exception as { status?: unknown; statusCode?: unknown };
    const s = typeof maybe.status === 'number' ? maybe.status : maybe.statusCode;
    if (typeof s === 'number' && s >= 400 && s <= 599) return s;
  }
  return null;
}

/**
 * Global exception filter. In production it returns a safe, minimal body -
 * no stack traces, no internal messages, no leaking of 5xx details (SECURITY.md
 * section 9). Full errors are logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    // HttpException client errors (4xx) may carry a validation body - keep it.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status < 500) {
        res.status(status).json(exception.getResponse());
        return;
      }
    }

    // Non-HttpException errors that carry a 4xx status (e.g. payload too large)
    // are rejected with a safe generic message, not treated as a 500.
    const carried = statusFromUnknown(exception);
    if (carried !== null && carried < 500) {
      res.status(carried).json({ statusCode: carried, message: 'Request rejected' });
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (carried ?? HttpStatus.INTERNAL_SERVER_ERROR);

    this.logger.error(
      exception instanceof Error ? `${exception.message}\n${exception.stack}` : String(exception),
    );

    const body =
      exception instanceof HttpException && !this.isProd
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    res.status(status).json(body);
  }
}

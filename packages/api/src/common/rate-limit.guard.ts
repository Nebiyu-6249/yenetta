import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';
import { RateLimiterService } from './rate-limiter.service';

/**
 * Enforces `@RateLimit(...)` on decorated routes, keyed by route + client IP.
 * Undecorated routes pass through untouched. Sets standard rate-limit headers
 * and a Retry-After on 429 (SECURITY.md section 8).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const route = options.key ?? `${context.getClass().name}.${context.getHandler().name}`;

    const decision = this.limiter.consume(`${route}:${ip}`, options.limit, options.windowMs);
    res.setHeader('X-RateLimit-Limit', options.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, decision.remaining));

    if (!decision.allowed) {
      res.setHeader('Retry-After', Math.ceil(decision.resetInMs / 1000));
      throw new HttpException(
        'Too many requests. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type ZodSchema } from 'zod';

/**
 * Validates and parses an incoming payload against a zod schema (BUILD_BRIEF
 * §12: zod for input validation). Throws 400 with field-level messages.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}

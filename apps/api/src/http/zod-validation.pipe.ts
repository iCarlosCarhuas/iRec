import {
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ZodType, infer as ZodInfer } from 'zod';

export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): ZodInfer<T> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new UnprocessableEntityException({
        type: 'https://irec.app/problems/validation-error',
        title: 'Validation error',
        status: 422,
        detail: 'La solicitud contiene campos invalidos.',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}

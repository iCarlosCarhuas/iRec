import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'object' && raw !== null && 'type' in raw) {
        response
          .status(status)
          .type('application/problem+json')
          .send({ ...raw, requestId });
        return;
      }

      const detail =
        typeof raw === 'string'
          ? raw
          : (raw as { message?: string }).message ?? exception.message;

      response
        .status(status)
        .type('application/problem+json')
        .send({
          type: `https://irec.app/problems/http-${status}`,
          title: HttpStatus[status] ?? 'HTTP error',
          status,
          detail,
          requestId,
        });
      return;
    }

    console.error('Unhandled request error', exception);

    response
      .status(500)
      .type('application/problem+json')
      .send({
        type: 'https://irec.app/problems/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Ocurrio un error inesperado.',
        requestId,
      });
  }
}

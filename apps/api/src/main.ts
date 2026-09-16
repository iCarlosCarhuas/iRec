import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import { openApiDocument } from './openapi/document.js';
import { ProblemDetailsFilter } from './http/problem-details.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    routeConflictPolicy: {
      duplicate: 'error',
      shadow: 'warn',
    },
    routeResolutionStrategy: 'specificity',
  });

  const port = Number(process.env.API_PORT ?? 3000);
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:4200';

  app.enableCors({
    origin: [webOrigin],
    credentials: true,
  });

  app.use(cookieParser());
  app.useGlobalFilters(new ProblemDetailsFilter());

  app.setGlobalPrefix('api');

  app.getHttpAdapter().get('/openapi.json', (_request: unknown, response: any) => {
    response.json(openApiDocument);
  });

  app.use(
    '/reference',
    apiReference({
      content: openApiDocument,
      theme: 'default',
      pageTitle: 'iRec API Reference',
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  console.log(`iRec API: http://127.0.0.1:${port}`);
  console.log(`Mailpit:  http://127.0.0.1:8025`);
  console.log(`Scalar:   http://127.0.0.1:${port}/reference`);
}

void bootstrap();

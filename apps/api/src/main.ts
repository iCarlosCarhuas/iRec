import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module.js';
import { openApiDocument } from './openapi/document.js';

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

  await app.listen(port);
  console.log(`iRec API: http://localhost:${port}`);
  console.log(`Scalar:   http://localhost:${port}/reference`);
}

void bootstrap();

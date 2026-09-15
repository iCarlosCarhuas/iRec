import { HealthResponseSchema, ProblemDetailsSchema } from '@irec/contracts';
import { createDocument } from 'zod-openapi';

export const openApiDocument = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'iRec API',
    version: '0.1.0',
    description: 'Contrato HTTP del MVP iRec. Zod es la fuente de verdad del schema.',
  },
  servers: [
    {
      url: '/api',
      description: 'Entorno actual',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Estado del servicio',
    },
  ],
  paths: {
    '/health/live': {
      get: {
        operationId: 'healthLive',
        tags: ['Health'],
        summary: 'Liveness de la API',
        responses: {
          '200': {
            description: 'La API esta ejecutandose',
            content: {
              'application/json': {
                schema: HealthResponseSchema,
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        operationId: 'healthReady',
        tags: ['Health'],
        summary: 'Readiness de la API',
        description: 'En 0.1.0 valida el proceso. Las dependencias se agregaran conforme se implementen.',
        responses: {
          '200': {
            description: 'La API esta lista',
            content: {
              'application/json': {
                schema: HealthResponseSchema,
              },
            },
          },
          '503': {
            description: 'Una dependencia critica no esta lista',
            content: {
              'application/problem+json': {
                schema: ProblemDetailsSchema,
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'irec_session',
        description: 'Reservado para Identity 0.2.0.',
      },
    },
  },
});

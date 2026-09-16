import { HttpErrorResponse } from '@angular/common/http';

type ProblemDetails = {
  detail?: unknown;
  title?: unknown;
  status?: unknown;
  requestId?: unknown;
};

export function uiError(
  error: unknown,
  fallback = 'No pudimos completar la solicitud.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'No se pudo conectar con iRec API. Verifica que el backend este ejecutandose.';
  }

  const body = error.error as ProblemDetails | string | null;

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object' && typeof body.detail === 'string') {
    return body.detail;
  }

  if (error.status === 429) {
    return 'Hay demasiados intentos. Espera un momento antes de volver a probar.';
  }

  if (error.status === 401) {
    return 'La sesion o el codigo ya no son validos. Vuelve a autenticarte.';
  }

  return fallback;
}

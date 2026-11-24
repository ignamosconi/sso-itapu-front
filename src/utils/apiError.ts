import axios from 'axios';
import { getRateLimitInfo, formatWait } from './rateLimit';

// Convierte el error de una llamada al backend en un texto para mostrarle a la persona.
//
// El backend (NestJS) devuelve `message` como texto o, en las validaciones de campos, como un array
// de textos; si se muestra el array tal cual, los mensajes quedan pegados sin separación. Además,
// un 429 o la caída de la red no traen un mensaje útil: acá se traducen.

/** Mensaje que mandó el servidor, como un solo texto ('' si no mandó ninguno). */
export function serverMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (Array.isArray(msg)) return msg.filter((m): m is string => typeof m === 'string').join(' ');
  return typeof msg === 'string' ? msg : '';
}

/** Hubo un error de red: la request salió pero no llegó una respuesta (servidor caído, sin conexión, CORS). */
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.';

export function getErrorMessage(err: unknown, fallback: string): string {
  const limit = getRateLimitInfo(err);
  if (limit) {
    return limit.kind === 'locked'
      ? `Se superó el máximo de intentos. Podrás volver a intentarlo en ${formatWait(limit.seconds)}.`
      : `Estás haciendo peticiones demasiado rápido. Probá de nuevo en ${formatWait(limit.seconds)}.`;
  }
  if (isNetworkError(err)) return NETWORK_ERROR_MESSAGE;

  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === 413) return 'El archivo es demasiado grande.';
  // Un 500 trae un texto técnico en inglés ('Internal server error'): no sirve para mostrar. El 503 sí: el backend
  // lo usa con un mensaje propio en español (por ejemplo, cuando Redis no está disponible).
  if (status !== undefined && status >= 500 && status !== 503) return fallback;

  return serverMessage(err) || fallback;
}

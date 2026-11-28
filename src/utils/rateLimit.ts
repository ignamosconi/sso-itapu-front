// Interpreta los errores de límites del backend y dice cuánto hay que esperar.
//
// El backend responde 429 por dos motivos distintos:
//  - 'throttled': demasiados requests seguidos desde la misma IP. La espera viene
//    en el header Retry-After (en segundos).
//  - 'locked': demasiados intentos de contraseña (de un alumno en la baja o el cambio de email,
//    o del propio admin al confirmar la edición de un usuario). La espera viene en el body
//    (retryAfterSeconds) y se identifica con code PASSWORD_ATTEMPTS_LOCKED o ADMIN_PASSWORD_ATTEMPTS_LOCKED.

export type RateLimitKind = 'throttled' | 'locked';

export interface RateLimitInfo {
  kind: RateLimitKind;
  seconds: number;
}

const LOCKED_CODES = ['PASSWORD_ATTEMPTS_LOCKED', 'ADMIN_PASSWORD_ATTEMPTS_LOCKED'];
// Si el 429 no trae un tiempo legible (por ejemplo, el header no llegó), se asume 1 minuto.
const DEFAULT_WAIT_SECONDS = 60;

function toPositiveSeconds(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

export function getRateLimitInfo(err: unknown): RateLimitInfo | null {
  const response = (err as {
    response?: {
      status?: number;
      headers?: Record<string, unknown>;
      data?: { code?: string; retryAfterSeconds?: unknown };
    };
  } | null)?.response;

  if (response?.status !== 429) return null;

  if (response.data?.code && LOCKED_CODES.includes(response.data.code)) {
    return {
      kind: 'locked',
      seconds: toPositiveSeconds(response.data.retryAfterSeconds) ?? DEFAULT_WAIT_SECONDS,
    };
  }

  return {
    kind: 'throttled',
    seconds: toPositiveSeconds(response.headers?.['retry-after']) ?? DEFAULT_WAIT_SECONDS,
  };
}

// ── Contraseña incorrecta (403) ──────────────────────────────────────────────
// Al fallar una contraseña, el backend responde 403 con cuántos intentos le quedan al alumno
// y, si ya no le quedan, cuánto dura el bloqueo.

export interface PasswordAttemptsInfo {
  attemptsRemaining: number;
  retryAfterSeconds: number;
}

export function getPasswordAttemptsInfo(err: unknown): PasswordAttemptsInfo | null {
  const response = (err as {
    response?: { status?: number; data?: { attemptsRemaining?: unknown; retryAfterSeconds?: unknown } };
  } | null)?.response;

  if (response?.status !== 403) return null;
  const remaining = Number(response.data?.attemptsRemaining);
  if (!Number.isInteger(remaining) || remaining < 0) return null;

  return {
    attemptsRemaining: remaining,
    retryAfterSeconds: toPositiveSeconds(response.data?.retryAfterSeconds) ?? DEFAULT_WAIT_SECONDS,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// 45 -> "45 segundos"; 61 -> "1 minuto y 1 segundo"; 900 -> "15 minutos"
export function formatWait(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  if (s < 60) return plural(s, 'segundo', 'segundos');
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  const minutesText = plural(minutes, 'minuto', 'minutos');
  return rest === 0 ? minutesText : `${minutesText} y ${plural(rest, 'segundo', 'segundos')}`;
}
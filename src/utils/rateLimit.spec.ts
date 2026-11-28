import { describe, it, expect } from 'vitest';
import { getRateLimitInfo, getPasswordAttemptsInfo, formatWait } from './rateLimit';

describe('getRateLimitInfo', () => {
  it('debería devolver null si el error no es un 429', () => {
    expect(getRateLimitInfo({ response: { status: 401 } })).toBeNull();
    expect(getRateLimitInfo(new Error('red'))).toBeNull();
    expect(getRateLimitInfo(null)).toBeNull();
    expect(getRateLimitInfo(undefined)).toBeNull();
  });

  it('debería leer la espera del header Retry-After cuando son demasiados requests', () => {
    const err = { response: { status: 429, headers: { 'retry-after': '42' }, data: { message: 'ThrottlerException' } } };
    expect(getRateLimitInfo(err)).toEqual({ kind: 'throttled', seconds: 42 });
  });

  it('debería leer la espera del body cuando el alumno está bloqueado por intentos', () => {
    const err = {
      response: { status: 429, headers: {}, data: { code: 'PASSWORD_ATTEMPTS_LOCKED', retryAfterSeconds: 600 } },
    };
    expect(getRateLimitInfo(err)).toEqual({ kind: 'locked', seconds: 600 });
  });

  it('debería reconocer el bloqueo por intentos de la contraseña del admin (edición de usuarios)', () => {
    const err = {
      response: { status: 429, headers: {}, data: { code: 'ADMIN_PASSWORD_ATTEMPTS_LOCKED', retryAfterSeconds: 300 } },
    };
    expect(getRateLimitInfo(err)).toEqual({ kind: 'locked', seconds: 300 });
  });

  it('debería usar 60 segundos si el 429 no trae un tiempo válido', () => {
    expect(getRateLimitInfo({ response: { status: 429 } })).toEqual({ kind: 'throttled', seconds: 60 });
    expect(getRateLimitInfo({ response: { status: 429, headers: { 'retry-after': 'abc' } } }))
      .toEqual({ kind: 'throttled', seconds: 60 });
    expect(getRateLimitInfo({ response: { status: 429, headers: { 'retry-after': '0' } } }))
      .toEqual({ kind: 'throttled', seconds: 60 });
    expect(getRateLimitInfo({ response: { status: 429, data: { code: 'PASSWORD_ATTEMPTS_LOCKED' } } }))
      .toEqual({ kind: 'locked', seconds: 60 });
  });

  it('debería redondear hacia arriba los segundos decimales', () => {
    expect(getRateLimitInfo({ response: { status: 429, headers: { 'retry-after': '1.2' } } }))
      .toEqual({ kind: 'throttled', seconds: 2 });
  });
});

describe('getPasswordAttemptsInfo', () => {
  it('debería devolver null si no es un 403 o no trae el conteo de intentos', () => {
    expect(getPasswordAttemptsInfo({ response: { status: 401 } })).toBeNull();
    expect(getPasswordAttemptsInfo({ response: { status: 403, data: { message: 'x' } } })).toBeNull();
    expect(getPasswordAttemptsInfo({ response: { status: 403, data: { attemptsRemaining: -1 } } })).toBeNull();
    expect(getPasswordAttemptsInfo({ response: { status: 403, data: { attemptsRemaining: 'abc' } } })).toBeNull();
    expect(getPasswordAttemptsInfo(null)).toBeNull();
  });

  it('debería devolver los intentos restantes y la espera', () => {
    const err = { response: { status: 403, data: { attemptsRemaining: 2, retryAfterSeconds: 840 } } };
    expect(getPasswordAttemptsInfo(err)).toEqual({ attemptsRemaining: 2, retryAfterSeconds: 840 });
  });

  it('debería aceptar 0 intentos restantes y usar 60 s si falta la espera', () => {
    const err = { response: { status: 403, data: { attemptsRemaining: 0 } } };
    expect(getPasswordAttemptsInfo(err)).toEqual({ attemptsRemaining: 0, retryAfterSeconds: 60 });
  });
});

describe('formatWait', () => {
  it('debería formatear segundos, minutos y combinaciones con su plural', () => {
    expect(formatWait(1)).toBe('1 segundo');
    expect(formatWait(45)).toBe('45 segundos');
    expect(formatWait(60)).toBe('1 minuto');
    expect(formatWait(61)).toBe('1 minuto y 1 segundo');
    expect(formatWait(900)).toBe('15 minutos');
    expect(formatWait(899)).toBe('14 minutos y 59 segundos');
  });

  it('no debería mostrar valores negativos', () => {
    expect(formatWait(-5)).toBe('0 segundos');
  });
});
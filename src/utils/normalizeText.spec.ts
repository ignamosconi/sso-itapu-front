import { describe, it, expect } from 'vitest';
import { normalizeText, includesNormalized } from './normalizeText';

describe('normalizeText', () => {
  it('debería quitar tildes y diéresis y pasar a minúsculas', () => {
    expect(normalizeText('Lucía PÉREZ Güemes')).toBe('lucia perez guemes');
  });

  it('debería plegar la ñ a n', () => {
    expect(normalizeText('Niño Núñez')).toBe('nino nunez');
  });

  it('debería recortar espacios en los extremos', () => {
    expect(normalizeText('  hola  ')).toBe('hola');
  });

  it('debería normalizar texto escrito con tildes descompuestas (NFD)', () => {
    expect(normalizeText('luciá')).toBe('lucia');
  });

  it('no debería alterar símbolos que aparecen en URLs', () => {
    expect(normalizeText('http://x.com/~a?b=c^d')).toBe('http://x.com/~a?b=c^d');
  });
});

describe('includesNormalized', () => {
  it('debería coincidir con y sin tilde en cualquiera de los dos lados', () => {
    expect(includesNormalized('Lucía', 'lucia')).toBe(true);
    expect(includesNormalized('Lucia', 'LUCÍA')).toBe(true);
  });

  it('debería coincidir con una búsqueda vacía o de solo espacios', () => {
    expect(includesNormalized('Lucía', '')).toBe(true);
    expect(includesNormalized('Lucía', '   ')).toBe(true);
  });

  it('no debería coincidir si el texto no contiene la búsqueda', () => {
    expect(includesNormalized('Lucía', 'marta')).toBe(false);
  });
});
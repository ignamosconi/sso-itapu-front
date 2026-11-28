import { describe, it, expect } from 'vitest';
import { missingPasswordRequirements, passwordPolicyError } from './passwordPolicy';

describe('passwordPolicy (misma regla que el backend)', () => {
  it.each(['Itapu#2026', 'Ñandú_2024', 'aB3$aB3$', 'Contraseña Segura 1!', 'Abcdefg1€'])('acepta %j', p => {
    expect(passwordPolicyError(p)).toBeNull();
  });

  it('lista todo lo que falta en un solo mensaje, en el mismo orden y con el mismo texto que la API', () => {
    expect(passwordPolicyError('abc')).toBe(
      'La contraseña no es segura. Le falta: al menos 8 caracteres, una letra mayúscula, un número, un caracter especial (por ejemplo ! # $ % _ -).',
    );
    expect(missingPasswordRequirements('')).toHaveLength(5);
  });

  it.each([
    ['itapu#2026', ['upper']],
    ['ITAPU#2026', ['lower']],
    ['Itapu#abcd', ['number']],
    ['Itapu20266', ['special']],
    ['Itapu 2026', ['special']], // el espacio no cuenta como caracter especial
    ['Áé1#óúñ', ['length']], // cuenta caracteres, no bytes
    ['Aa1bcdef\u200B', ['special']], // un caracter invisible no cuenta como especial
    ['Aa1#\u0301\u0301\u0301\u0301', ['length']], // las marcas combinantes no suman al largo
    ['Ñandú_2026'.normalize('NFD'), []], // letras con tilde escritas como letra + tilde combinante
  ])('%j → falta %j', (p, keys) => {
    expect(missingPasswordRequirements(p).map(r => r.key)).toEqual(keys);
  });

  it('si cumple la política pero supera 72 bytes, avisa el límite de bcrypt', () => {
    expect(passwordPolicyError('Aa1#' + 'ñ'.repeat(35))).toMatch(/no puede superar los 72 bytes/);
    expect(passwordPolicyError('Aa1#' + 'a'.repeat(68))).toBeNull();
  });
});

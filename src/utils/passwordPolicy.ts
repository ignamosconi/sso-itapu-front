// Política de contraseñas: la misma regla que aplica el backend
// (sso-itapu-back/src/common/validators/password-policy.validator.ts). Si cambia allá, cambiarla acá.

export const PASSWORD_MIN_LENGTH = 8;

// bcrypt solo tiene en cuenta los primeros 72 bytes de una contraseña; el backend rechaza las más largas.
// Se cuentan bytes y no caracteres: una tilde o la ñ pesan 2.
export const MAX_PASSWORD_BYTES = 72;

export interface PasswordRequirement {
  key: 'length' | 'upper' | 'lower' | 'number' | 'special';
  /** Texto que completa "Le falta: …" (mismo texto que devuelve la API). */
  message: string;
  /** Texto corto para la lista de requisitos. */
  label: string;
  test: (password: string) => boolean;
}

// Las marcas combinantes y los caracteres invisibles o de control no cuentan para el largo ni como especial
// (no se ven al escribir). Igual que en el backend.
const visibleChars = (p: string): string[] => [...p.normalize('NFC')].filter(c => !/[\p{M}\p{C}]/u.test(c));

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  { key: 'length', message: `al menos ${PASSWORD_MIN_LENGTH} caracteres`, label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, test: p => visibleChars(p).length >= PASSWORD_MIN_LENGTH },
  { key: 'upper', message: 'una letra mayúscula', label: 'Una letra mayúscula', test: p => /\p{Lu}/u.test(p) },
  { key: 'lower', message: 'una letra minúscula', label: 'Una letra minúscula', test: p => /\p{Ll}/u.test(p) },
  { key: 'number', message: 'un número', label: 'Un número', test: p => /\p{Nd}/u.test(p) },
  // Caracter especial = cualquier cosa que no sea letra, número, espacio ni caracter invisible.
  { key: 'special', message: 'un caracter especial (por ejemplo ! # $ % _ -)', label: 'Un caracter especial (por ejemplo ! # $ % _ -)', test: p => /[^\p{L}\p{N}\p{M}\p{C}\s]/u.test(p) },
];

/** Todos los requisitos que la contraseña NO cumple (vacío = cumple la política). */
export function missingPasswordRequirements(password: string): PasswordRequirement[] {
  return PASSWORD_REQUIREMENTS.filter(r => !r.test(password));
}

export function exceedsPasswordBytes(password: string): boolean {
  return new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
}

export const PASSWORD_BYTES_MESSAGE =
  'La contraseña no puede superar los 72 bytes (unos 72 caracteres; las tildes y la ñ cuentan doble).';

/**
 * Un único mensaje con TODO lo que le falta a la contraseña (o con el exceso de bytes), o null si es válida.
 * Es el mismo texto que devuelve la API, así el usuario ve lo mismo venga de donde venga.
 */
export function passwordPolicyError(password: string): string | null {
  const missing = missingPasswordRequirements(password);
  if (missing.length > 0) return `La contraseña no es segura. Le falta: ${missing.map(r => r.message).join(', ')}.`;
  if (exceedsPasswordBytes(password)) return PASSWORD_BYTES_MESSAGE;
  return null;
}

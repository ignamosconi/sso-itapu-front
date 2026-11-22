/**
 * Normaliza un texto para compararlo en búsquedas: minúsculas, sin tildes ni
 * diéresis (á → a, ü → u) y sin espacios en los extremos.
 * Ojo: la ñ también se pliega a "n" (así "nino" encuentra "niño").
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * true si `text` contiene `search`, ignorando mayúsculas y tildes.
 * Una búsqueda vacía coincide con todo.
 */
export function includesNormalized(text: string, search: string): boolean {
  return normalizeText(text).includes(normalizeText(search));
}
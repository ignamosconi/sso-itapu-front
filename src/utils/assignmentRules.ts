// Reglas de asignación de cargos y especialidades. Copia de la lógica del backend
// (src/domain-role/utils/assignment-rules.ts) SOLO para avisar en el formulario antes de enviar:
// quien decide es siempre el backend, que valida lo mismo en todos los puntos de entrada.
//
//  1. Todo usuario tiene al menos un cargo y al menos una especialidad.
//  2. Si ALGUNO de sus cargos "no se combina", el usuario debe tener exactamente un cargo.
//  3. Si ALGUNO de sus cargos exige "exactamente una especialidad", el usuario debe tener una sola.

export interface RuleRole {
  name: string;
  exclusive: boolean;
  singleSpecialty: boolean;
}

/** Mismos topes que el backend. */
export const MAX_ROLES_PER_USER = 10;
export const MAX_SPECIALTIES_PER_USER = 20;

export function checkAssignmentRules(roles: RuleRole[], specialtyCount: number): string[] {
  const errors: string[] = [];
  if (roles.length === 0) errors.push('Debe tener al menos un cargo.');
  if (specialtyCount === 0) errors.push('Debe tener al menos una especialidad.');
  if (roles.length > 1) {
    for (const r of roles.filter(role => role.exclusive)) {
      errors.push(`El cargo "${r.name}" no se puede combinar con otros cargos.`);
    }
  }
  if (specialtyCount > 1) {
    for (const r of roles.filter(role => role.singleSpecialty)) {
      errors.push(`El cargo "${r.name}" exige exactamente una especialidad (se indicaron ${specialtyCount}).`);
    }
  }
  return errors;
}

/** Texto corto de las reglas de un cargo, para tablas y opciones de selección. */
export function describeRoleRules(role: RuleRole): string {
  const parts: string[] = [];
  if (role.exclusive) parts.push('no se combina');
  if (role.singleSpecialty) parts.push('una sola especialidad');
  return parts.join(' · ');
}

/**
 * Errores de reglas para una selección hecha con ids en texto (formato de MultiSelect).
 * Devuelve [] si es válida. Sirve para avisar y deshabilitar el envío; el backend vuelve a validar.
 */
export function assignmentErrors(
  roles: (RuleRole & { id: number })[], roleIds: string[], specialtyIds: string[],
): string[] {
  const selected = roles.filter(r => roleIds.includes(String(r.id)));
  return checkAssignmentRules(selected, specialtyIds.length);
}

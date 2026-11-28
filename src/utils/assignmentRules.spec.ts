import { describe, it, expect } from 'vitest';
import { assignmentErrors, checkAssignmentRules, describeRoleRules, RuleRole } from './assignmentRules';

const role = (name: string, exclusive = false, singleSpecialty = false): RuleRole => ({ name, exclusive, singleSpecialty });

describe('checkAssignmentRules (misma lógica que el backend)', () => {
  it('acepta combinaciones libres', () => {
    expect(checkAssignmentRules([role('Profesor'), role('Preceptor')], 3)).toEqual([]);
  });

  it('exige al menos un cargo y una especialidad', () => {
    expect(checkAssignmentRules([], 0)).toEqual(['Debe tener al menos un cargo.', 'Debe tener al menos una especialidad.']);
  });

  it('un cargo que no se combina debe ser el único', () => {
    expect(checkAssignmentRules([role('Alumno', true)], 1)).toEqual([]);
    expect(checkAssignmentRules([role('Alumno', true), role('Profesor')], 1))
      .toEqual(['El cargo "Alumno" no se puede combinar con otros cargos.']);
  });

  it('si ALGUNO de los cargos exige una sola especialidad, aplica a todo el usuario', () => {
    expect(checkAssignmentRules([role('Profesor'), role('Regente', false, true)], 2))
      .toEqual(['El cargo "Regente" exige exactamente una especialidad (se indicaron 2).']);
    expect(checkAssignmentRules([role('Profesor'), role('Regente', false, true)], 1)).toEqual([]);
  });
});

describe('describeRoleRules', () => {
  it('describe las reglas activas', () => {
    expect(describeRoleRules(role('Profesor'))).toBe('');
    expect(describeRoleRules(role('Alumno', true, true))).toBe('no se combina · una sola especialidad');
    expect(describeRoleRules(role('Regente', false, true))).toBe('una sola especialidad');
  });
});

describe('assignmentErrors', () => {
  const roles = [
    { id: 1, ...role('Alumno', true, true) },
    { id: 2, ...role('Profesor') },
  ];
  it('usa solo los cargos seleccionados (ids en texto)', () => {
    expect(assignmentErrors(roles, ['2'], ['5', '6'])).toEqual([]);
    expect(assignmentErrors(roles, ['1', '2'], ['5'])).toEqual(['El cargo "Alumno" no se puede combinar con otros cargos.']);
  });
  it('ignora ids que no están en el catálogo', () => {
    expect(assignmentErrors(roles, ['99'], ['5'])).toEqual(['Debe tener al menos un cargo.']);
  });
});

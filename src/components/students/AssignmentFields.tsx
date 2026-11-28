import { useState } from 'react';
import { MultiSelect, Alert, Text, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { DomainRoleResponse, SpecialtyResponse } from '@/types/api.types';
import {
  assignmentErrors, describeRoleRules, MAX_ROLES_PER_USER, MAX_SPECIALTIES_PER_USER,
} from '@/utils/assignmentRules';

interface AssignmentFieldsProps {
  roles: DomainRoleResponse[];
  specialties: SpecialtyResponse[];
  /** Ids seleccionados, como texto (formato de MultiSelect). */
  roleIds: string[];
  specialtyIds: string[];
  onRoleIdsChange: (ids: string[]) => void;
  onSpecialtyIdsChange: (ids: string[]) => void;
}

/** Ids que están en `next` y no en `prev` (lo que el usuario acaba de agregar). */
function addedIds(prev: string[], next: string[]): string[] {
  return next.filter(id => !prev.includes(id));
}

/**
 * Selección múltiple de cargos y especialidades con aviso inmediato de las reglas de cada cargo.
 * La usan el alta individual y la edición de usuarios. El backend vuelve a validar todo.
 *
 * Los desplegables se cierran solos cuando la opción elegida no admite más:
 *  - Cargos: al elegir un cargo que "no se combina" (por ejemplo Alumno).
 *  - Especialidades: al elegir una cuando alguno de los cargos elegidos exige exactamente una.
 * Se pueden volver a abrir con un clic para agregar más; en ese caso aparece el aviso de reglas.
 * Con cargos que se combinan (por ejemplo Profesor) el desplegable queda abierto para seguir eligiendo.
 */
export function AssignmentFields({
  roles, specialties, roleIds, specialtyIds, onRoleIdsChange, onSpecialtyIdsChange,
}: AssignmentFieldsProps) {
  const [rolesOpened, setRolesOpened] = useState(false);
  const [specialtiesOpened, setSpecialtiesOpened] = useState(false);

  const handleRoleIdsChange = (ids: string[]) => {
    const added = addedIds(roleIds, ids);
    if (added.some(id => roles.find(r => String(r.id) === id)?.exclusive)) setRolesOpened(false);
    onRoleIdsChange(ids);
  };

  const handleSpecialtyIdsChange = (ids: string[]) => {
    const requiresSingle = roles.some(r => r.singleSpecialty && roleIds.includes(String(r.id)));
    if (requiresSingle && addedIds(specialtyIds, ids).length > 0) setSpecialtiesOpened(false);
    onSpecialtyIdsChange(ids);
  };

  const touched = roleIds.length > 0 || specialtyIds.length > 0;
  // "Al menos uno" ya lo marca el `required` de cada campo: acá se muestran solo las reglas de los cargos.
  const ruleErrors = touched
    ? assignmentErrors(roles, roleIds, specialtyIds).filter(e => !e.startsWith('Debe tener al menos'))
    : [];

  return (
    <Stack gap="sm">
      <MultiSelect
        label="Cargos institucionales"
        description="Podés elegir más de uno."
        placeholder={roleIds.length ? undefined : 'Seleccioná...'}
        data={roles.map(r => {
          const rules = describeRoleRules(r);
          return { value: String(r.id), label: rules ? `${r.name} (${rules})` : r.name };
        })}
        value={roleIds}
        onChange={handleRoleIdsChange}
        dropdownOpened={rolesOpened}
        onDropdownOpen={() => setRolesOpened(true)}
        onDropdownClose={() => setRolesOpened(false)}
        maxValues={MAX_ROLES_PER_USER}
        searchable
        required
      />
      <MultiSelect
        label="Especialidades"
        description="Podés elegir más de una, salvo que alguno de los cargos exija exactamente una."
        placeholder={specialtyIds.length ? undefined : 'Seleccioná...'}
        data={specialties.map(s => ({ value: String(s.id), label: s.name }))}
        value={specialtyIds}
        onChange={handleSpecialtyIdsChange}
        dropdownOpened={specialtiesOpened}
        onDropdownOpen={() => setSpecialtiesOpened(true)}
        onDropdownClose={() => setSpecialtiesOpened(false)}
        maxValues={MAX_SPECIALTIES_PER_USER}
        searchable
        required
      />
      {ruleErrors.length > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" role="alert" title="La selección no cumple las reglas de los cargos">
          {ruleErrors.map(e => <Text key={e} size="sm">{e}</Text>)}
        </Alert>
      )}
    </Stack>
  );
}

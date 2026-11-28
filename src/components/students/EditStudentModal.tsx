import { useEffect, useState } from 'react';
import {
  Modal, Text, TextInput, PasswordInput, Group, Button, Alert, Box,
} from '@mantine/core';
import { IconAlertCircle, IconClockPause, IconInfoCircle } from '@tabler/icons-react';
import { studentsApi } from '@/api/studentsApi';
import {
  StudentResponse, DomainRoleResponse, SpecialtyResponse, UpdateStudentPayload,
} from '@/types/api.types';
import { getErrorMessage } from '@/utils/apiError';
import { getRateLimitInfo, getPasswordAttemptsInfo, formatWait, RateLimitKind } from '@/utils/rateLimit';
import { AssignmentFields } from './AssignmentFields';
import { assignmentErrors } from '@/utils/assignmentRules';

interface EditStudentModalProps {
  /** Usuario a editar; `null` cierra el modal. */
  student: StudentResponse | null;
  roles: DomainRoleResponse[];
  specialties: SpecialtyResponse[];
  onClose: () => void;
  /** Se llama después de guardar con éxito, con el usuario actualizado. */
  onSaved: (updated: StudentResponse) => void;
}

const idsOf = (refs: { id: number }[]) => refs.map(r => String(r.id)).sort();
const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/**
 * Edición de un usuario del padrón (nombres, DNI, fecha de nacimiento, cargos y especialidades).
 * Exige la contraseña del admin que hace el cambio; el usuario recibe un email con el antes y el después.
 * Solo se envían los campos que cambiaron.
 */
export function EditStudentModal({ student, roles, specialties, onClose, onSaved }: EditStudentModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [specIds, setSpecIds] = useState<string[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [rateLimit, setRateLimit] = useState<{ kind: RateLimitKind; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!student) return;
    setFirstName(student.first_name);
    setLastName(student.last_name);
    setDni(String(student.dni));
    setBirthDate(student.birth_date.slice(0, 10));
    setRoleIds(idsOf(student.domainRoles));
    setSpecIds(idsOf(student.specialties));
    setAdminPassword('');
    setError(null);
    setLoading(false);
  }, [student]);

  useEffect(() => {
    if (!rateLimit) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= rateLimit.until) setRateLimit(null);
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimit]);

  const waitSeconds = rateLimit ? Math.max(0, Math.ceil((rateLimit.until - now) / 1000)) : 0;

  const startCooldown = (kind: RateLimitKind, seconds: number) => {
    const t = Date.now();
    setNow(t);
    setRateLimit({ kind, until: t + seconds * 1000 });
  };

  /** Arma el payload solo con lo que cambió. Devuelve `null` si no hay cambios. */
  const buildChanges = (): Omit<UpdateStudentPayload, 'admin_password'> | null => {
    if (!student) return null;
    const changes: Omit<UpdateStudentPayload, 'admin_password'> = {};
    if (firstName.trim() !== student.first_name) changes.first_name = firstName.trim();
    if (lastName.trim() !== student.last_name) changes.last_name = lastName.trim();
    if (dni.trim() !== String(student.dni)) changes.dni = parseInt(dni.trim(), 10);
    if (birthDate !== student.birth_date.slice(0, 10)) changes.birth_date = birthDate;
    if (!sameIds(roleIds, idsOf(student.domainRoles))) changes.domain_role_ids = roleIds.map(Number);
    if (!sameIds(specIds, idsOf(student.specialties))) changes.specialty_ids = specIds.map(Number);
    return Object.keys(changes).length ? changes : null;
  };

  const ruleErrors = assignmentErrors(roles, roleIds, specIds);

  // La contraseña no queda en memoria si se cancela.
  const handleClose = () => {
    setAdminPassword('');
    onClose();
  };

  const handleSave = async () => {
    if (!student || loading || waitSeconds > 0) return;
    setError(null);

    if (!firstName.trim() || !lastName.trim()) { setError('Completá nombre y apellido.'); return; }
    if (!/^\d{7,10}$/.test(dni.trim())) { setError('Ingresá un DNI válido (solo números).'); return; }
    if (!birthDate) { setError('Ingresá la fecha de nacimiento.'); return; }
    if (ruleErrors.length) { setError(ruleErrors.join(' ')); return; }
    const changes = buildChanges();
    if (!changes) { setError('No hay cambios para guardar.'); return; }
    if (!adminPassword) { setError('Ingresá tu contraseña de administrador para confirmar los cambios.'); return; }

    setLoading(true);
    try {
      const updated = await studentsApi.update(student.id, { ...changes, admin_password: adminPassword });
      setAdminPassword('');
      onSaved(updated);
    } catch (err) {
      setAdminPassword('');
      const rl = getRateLimitInfo(err);
      const wrong = getPasswordAttemptsInfo(err);
      if (rl) {
        startCooldown(rl.kind, rl.seconds);
      } else if (wrong) {
        if (wrong.attemptsRemaining === 0) {
          startCooldown('locked', wrong.retryAfterSeconds);
        } else {
          const n = wrong.attemptsRemaining;
          setError(`Tu contraseña de administrador es incorrecta. Te ${n === 1 ? 'queda 1 intento' : `quedan ${n} intentos`}.`);
        }
      } else {
        setError(getErrorMessage(err, 'Error al guardar los cambios.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={student !== null} onClose={handleClose} title="Editar usuario" centered size="lg">
      <Text size="sm" mb="sm">
        Estás editando a <strong>{student?.first_name} {student?.last_name}</strong> ({student?.username}).
      </Text>
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
        El usuario recibirá un email con los datos anteriores y los nuevos. En las apps conectadas, los cambios
        pueden tardar hasta 15 minutos en verse (o hasta que vuelva a iniciar sesión). El email y la contraseña
        no se editan desde acá.
      </Alert>

      {waitSeconds > 0 && rateLimit && (
        <Alert icon={<IconClockPause size={16} />} color="orange" mb="sm" role="alert">
          {rateLimit.kind === 'locked'
            ? 'Superaste el máximo de intentos con tu contraseña de administrador. '
            : 'Estás haciendo peticiones demasiado rápido. '}
          Podrás volver a intentarlo en <strong>{formatWait(waitSeconds)}</strong>.
        </Alert>
      )}
      {error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm" role="alert">{error}</Alert>}

      <Group grow mb="sm">
        <TextInput label="Nombre/s" value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={100} required />
        <TextInput label="Apellido/s" value={lastName} onChange={e => setLastName(e.target.value)} maxLength={100} required />
      </Group>
      <Group grow mb="sm">
        <TextInput label="DNI" value={dni} onChange={e => setDni(e.target.value)} inputMode="numeric" maxLength={10} required />
        <TextInput label="Fecha de nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
      </Group>
      <Box mb="md">
        <AssignmentFields
          roles={roles}
          specialties={specialties}
          roleIds={roleIds}
          specialtyIds={specIds}
          onRoleIdsChange={setRoleIds}
          onSpecialtyIdsChange={setSpecIds}
        />
      </Box>
      <PasswordInput
        label="Tu contraseña de administrador"
        description="Para confirmar los cambios."
        placeholder="••••••••"
        value={adminPassword}
        onChange={e => setAdminPassword(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void handleSave(); }}
        // Que el navegador no la autocomplete: el paso de confirmación tiene que ser algo que se sabe.
        autoComplete="new-password"
        mb="lg"
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" onClick={handleClose}>Cancelar</Button>
        <Button
          loading={loading}
          disabled={waitSeconds > 0 || ruleErrors.length > 0}
          onClick={() => void handleSave()}
        >
          Guardar cambios
        </Button>
      </Group>
    </Modal>
  );
}

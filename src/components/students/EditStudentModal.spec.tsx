import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EditStudentModal } from './EditStudentModal';
import { studentsApi } from '@/api/studentsApi';
import { DomainRoleResponse, SpecialtyResponse, StudentResponse } from '@/types/api.types';

vi.mock('@/api/studentsApi', () => ({
  studentsApi: { update: vi.fn() },
}));

const ts = '2026-01-01T00:00:00Z';
const roles: DomainRoleResponse[] = [
  { id: 1, name: 'Alumno', exclusive: true, singleSpecialty: true, createdAt: ts, updatedAt: ts },
  { id: 2, name: 'Preceptor', exclusive: false, singleSpecialty: false, createdAt: ts, updatedAt: ts },
  { id: 3, name: 'Profesor', exclusive: false, singleSpecialty: false, createdAt: ts, updatedAt: ts },
];
const specialties: SpecialtyResponse[] = [
  { id: 10, name: 'Electrónica', createdAt: ts, updatedAt: ts },
  { id: 11, name: 'Sistemas', createdAt: ts, updatedAt: ts },
];

const student: StudentResponse = {
  id: 'stu-1',
  username: 'j.perez',
  first_name: 'Juan',
  last_name: 'Pérez',
  email: 'juan@itapu.edu.ar',
  dni: 40123456,
  birth_date: '2000-05-10',
  account_status: 'active',
  hasPassword: true,
  domainRoles: [{ id: 3, name: 'Profesor' }],
  specialties: [{ id: 11, name: 'Sistemas' }],
  createdAt: ts,
  updatedAt: ts,
};

function renderModal(overrides: Partial<Parameters<typeof EditStudentModal>[0]> = {}) {
  const props = {
    student,
    roles,
    specialties,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  render(
    <MantineProvider>
      <EditStudentModal {...props} />
    </MantineProvider>,
  );
  return props;
}

function pickOption(comboboxName: RegExp, option: RegExp) {
  const input = screen.getByRole('combobox', { name: comboboxName });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('option', { name: option, hidden: true }));
}

const typeAdminPassword = (value = 'admin-pass') =>
  fireEvent.change(screen.getByLabelText(/Tu contraseña de administrador/), { target: { value } });
const clickSave = () => fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

describe('EditStudentModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería precargar los datos actuales del usuario', () => {
    renderModal();
    expect(screen.getByLabelText(/Nombre\/s/)).toHaveValue('Juan');
    expect(screen.getByLabelText(/Apellido\/s/)).toHaveValue('Pérez');
    expect(screen.getByLabelText(/^DNI/)).toHaveValue('40123456');
    expect(screen.getByLabelText(/Fecha de nacimiento/)).toHaveValue('2000-05-10');
    expect(screen.getByText(/recibirá un email con los datos anteriores y los nuevos/)).toBeInTheDocument();
  });

  it('debería enviar solo los campos que cambiaron, con los cargos como lista de ids', async () => {
    vi.mocked(studentsApi.update).mockResolvedValueOnce({
      ...student, domainRoles: [{ id: 2, name: 'Preceptor' }, { id: 3, name: 'Profesor' }],
    });
    const props = renderModal();

    pickOption(/Cargos institucionales/i, /^Preceptor/);
    typeAdminPassword();
    clickSave();

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(studentsApi.update).toHaveBeenCalledWith('stu-1', {
      domain_role_ids: [3, 2],
      admin_password: 'admin-pass',
    });
  });

  it('no debería llamar al backend si no hay cambios', () => {
    renderModal();
    typeAdminPassword();
    clickSave();
    expect(screen.getByText('No hay cambios para guardar.')).toBeInTheDocument();
    expect(studentsApi.update).not.toHaveBeenCalled();
  });

  it('debería pedir la contraseña del admin antes de enviar', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Nombre\/s/), { target: { value: 'Juan Carlos' } });
    clickSave();
    expect(screen.getByText(/Ingresá tu contraseña de administrador/)).toBeInTheDocument();
    expect(studentsApi.update).not.toHaveBeenCalled();
  });

  it('debería mostrar las reglas incumplidas y deshabilitar el guardado', () => {
    renderModal();
    pickOption(/Cargos institucionales/i, /^Alumno/);
    pickOption(/Especialidades/i, /^Electrónica/);

    expect(screen.getByText(/El cargo "Alumno" no se puede combinar con otros cargos/)).toBeInTheDocument();
    expect(screen.getByText(/El cargo "Alumno" exige exactamente una especialidad/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeDisabled();
  });

  describe('desplegables que se cierran solos', () => {
    const isOpen = (name: RegExp) => screen.getByRole('combobox', { name }).getAttribute('aria-expanded') === 'true';
    const open = (name: RegExp) => fireEvent.click(screen.getByRole('combobox', { name }));
    const option = (name: RegExp) => screen.getByRole('option', { name, hidden: true });

    it('cargos: se cierra al elegir uno que no se combina (Alumno), y se puede reabrir para agregar más', () => {
      renderModal({ student: { ...student, domainRoles: [], specialties: [] } });
      open(/Cargos institucionales/i);
      expect(isOpen(/Cargos institucionales/i)).toBe(true);

      fireEvent.click(option(/^Alumno/));
      expect(isOpen(/Cargos institucionales/i)).toBe(false);

      // El usuario puede volver a abrirlo y elegir otro: entonces aparece el aviso de reglas.
      open(/Cargos institucionales/i);
      expect(isOpen(/Cargos institucionales/i)).toBe(true);
      fireEvent.click(option(/^Profesor/));
      expect(isOpen(/Cargos institucionales/i)).toBe(true);
      expect(screen.getByText(/El cargo "Alumno" no se puede combinar con otros cargos/)).toBeInTheDocument();
    });

    it('cargos: queda abierto al elegir uno que se combina (Profesor, Preceptor)', () => {
      renderModal({ student: { ...student, domainRoles: [], specialties: [] } });
      open(/Cargos institucionales/i);
      fireEvent.click(option(/^Profesor/));
      expect(isOpen(/Cargos institucionales/i)).toBe(true);
      fireEvent.click(option(/^Preceptor/));
      expect(isOpen(/Cargos institucionales/i)).toBe(true);
    });

    it('cargos: quitar un cargo exclusivo desde la lista no cierra el desplegable', () => {
      renderModal({ student: { ...student, domainRoles: [{ id: 1, name: 'Alumno' }] } });
      open(/Cargos institucionales/i);
      fireEvent.click(option(/^Alumno/)); // ya estaba elegido: lo quita
      expect(isOpen(/Cargos institucionales/i)).toBe(true);
    });

    it('especialidades: se cierra al elegir una si algún cargo exige exactamente una', () => {
      renderModal({ student: { ...student, domainRoles: [{ id: 1, name: 'Alumno' }], specialties: [] } });
      open(/Especialidades/i);
      fireEvent.click(option(/^Sistemas/));
      expect(isOpen(/Especialidades/i)).toBe(false);

      open(/Especialidades/i);
      fireEvent.click(option(/^Electrónica/));
      expect(isOpen(/Especialidades/i)).toBe(false);
      expect(screen.getByText(/El cargo "Alumno" exige exactamente una especialidad/)).toBeInTheDocument();
    });

    it('especialidades: queda abierto si ningún cargo exige una sola', () => {
      renderModal({ student: { ...student, specialties: [] } }); // Profesor
      open(/Especialidades/i);
      fireEvent.click(option(/^Sistemas/));
      expect(isOpen(/Especialidades/i)).toBe(true);
      fireEvent.click(option(/^Electrónica/));
      expect(isOpen(/Especialidades/i)).toBe(true);
    });
  });

  it('debería informar cuántos intentos quedan si la contraseña del admin es incorrecta', async () => {
    vi.mocked(studentsApi.update).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Tu contraseña de administrador es incorrecta.', attemptsRemaining: 2, retryAfterSeconds: 900 } },
    });
    const props = renderModal();
    fireEvent.change(screen.getByLabelText(/Nombre\/s/), { target: { value: 'Juan Carlos' } });
    typeAdminPassword('mala');
    clickSave();

    expect(await screen.findByText(/Tu contraseña de administrador es incorrecta\. Te quedan 2 intentos\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tu contraseña de administrador/)).toHaveValue('');
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('debería bloquear el guardado con cuenta regresiva al agotar los intentos (429)', async () => {
    vi.mocked(studentsApi.update).mockRejectedValueOnce({
      response: { status: 429, data: { code: 'ADMIN_PASSWORD_ATTEMPTS_LOCKED', retryAfterSeconds: 900 } },
    });
    renderModal();
    fireEvent.change(screen.getByLabelText(/Nombre\/s/), { target: { value: 'Juan Carlos' } });
    typeAdminPassword('mala');
    clickSave();

    expect(await screen.findByText(/Superaste el máximo de intentos/)).toBeInTheDocument();
    expect(screen.getByText('15 minutos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeDisabled();
  });

  it('debería mostrar el mensaje del servidor ante otros errores (por ejemplo, DNI repetido)', async () => {
    vi.mocked(studentsApi.update).mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Ya existe un usuario con ese DNI.' } },
    });
    renderModal();
    fireEvent.change(screen.getByLabelText(/^DNI/), { target: { value: '41000000' } });
    typeAdminPassword();
    clickSave();

    expect(await screen.findByText('Ya existe un usuario con ese DNI.')).toBeInTheDocument();
    expect(studentsApi.update).toHaveBeenCalledWith('stu-1', { dni: 41000000, admin_password: 'admin-pass' });
  });

  it('no debería dejar la contraseña del admin cargada al cancelar ni ofrecer autocompletarla', () => {
    const props = renderModal();
    const input = screen.getByLabelText(/Tu contraseña de administrador/);
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    typeAdminPassword('secreta');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onClose).toHaveBeenCalled();
    expect(screen.getByLabelText(/Tu contraseña de administrador/)).toHaveValue('');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PadronPage } from './PadronPage';
import { studentsApi } from '@/api/studentsApi';
import { rolesApi } from '@/api/rolesApi';
import { specialtiesApi } from '@/api/specialtiesApi';
import { StudentResponse, ResponsibleApp } from '@/types/api.types';

vi.mock('@/api/studentsApi', () => ({
  studentsApi: {
    findAll: vi.fn(),
    suspend: vi.fn(),
    activate: vi.fn(),
    remove: vi.fn(),
    getPasswordLock: vi.fn(),
    requestEmailChange: vi.fn(),
    resendWelcome: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/api/rolesApi', () => ({
  rolesApi: { findAll: vi.fn() },
}));

vi.mock('@/api/specialtiesApi', () => ({
  specialtiesApi: { findAll: vi.fn() },
}));

const studentActiveWithPass: StudentResponse = {
  id: 'stu-1',
  username: 'j.perez',
  first_name: 'Juan',
  last_name: 'Pérez',
  email: 'juan.perez@itapu.edu.ar',
  dni: 40123456,
  birth_date: '2000-05-10',
  account_status: 'active',
  hasPassword: true,
  domainRoles: [{ id: 1, name: 'Alumno' }],
  specialties: [{ id: 1, name: 'Sistemas' }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const studentPendingNoPass: StudentResponse = {
  id: 'stu-2',
  username: 'm.gomez',
  first_name: 'María',
  last_name: 'Gómez',
  email: 'maria.gomez@itapu.edu.ar',
  dni: 41987654,
  birth_date: '2001-08-20',
  account_status: 'pending_registration',
  hasPassword: false,
  domainRoles: [{ id: 1, name: 'Alumno' }],
  specialties: [{ id: 2, name: 'Química' }],
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function renderPadron() {
  return render(
    <MantineProvider>
      <PadronPage />
    </MantineProvider>,
  );
}

describe('PadronPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(studentsApi.getPasswordLock).mockResolvedValue({ locked: false, retryAfterSeconds: 0 });
    vi.mocked(rolesApi.findAll).mockResolvedValue([
      { id: 1, name: 'Alumno', exclusive: true, singleSpecialty: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    vi.mocked(specialtiesApi.findAll).mockResolvedValue([
      { id: 1, name: 'Sistemas', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Química', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
  });

  it('debería listar usuarios del padrón y disparar búsqueda por texto', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({
      data: [studentActiveWithPass, studentPendingNoPass],
      total: 2,
    });

    renderPadron();

    expect(await screen.findByText('j.perez')).toBeInTheDocument();
    expect(screen.getByText('m.gomez')).toBeInTheDocument();
    expect(screen.getByText(/Total: 2/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Usuario, nombre o DNI/i), { target: { value: 'Pérez' } });

    await waitFor(() => {
      expect(studentsApi.findAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Pérez', page: 1 }),
      );
    });
  });

  it('debería suspender y reactivar una cuenta', async () => {
    vi.mocked(studentsApi.findAll)
      .mockResolvedValueOnce({ data: [studentActiveWithPass], total: 1 })
      .mockResolvedValueOnce({ data: [{ ...studentActiveWithPass, account_status: 'suspended' }], total: 1 })
      .mockResolvedValueOnce({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.suspend).mockResolvedValueOnce({ ...studentActiveWithPass, account_status: 'suspended' });
    vi.mocked(studentsApi.activate).mockResolvedValueOnce(studentActiveWithPass);

    const { container } = renderPadron();
    await screen.findByText('j.perez');

    // Fila activa sin pending_registration tiene 2 botones: [0]=Suspender, [1]=Dar de baja
    let rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[0]);

    expect(await screen.findByText('Suspendido')).toBeInTheDocument();
    expect(studentsApi.suspend).toHaveBeenCalledWith('stu-1');

    // Reactivar
    rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[0]);

    expect(await screen.findByText('Activo')).toBeInTheDocument();
    expect(studentsApi.activate).toHaveBeenCalledWith('stu-1');
  });

  it('debería reenviar email de bienvenida en usuarios pendientes mostrando email enmascarado', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValueOnce({ data: [studentPendingNoPass], total: 1 });
    vi.mocked(studentsApi.resendWelcome).mockResolvedValueOnce(undefined);

    const { container } = renderPadron();
    await screen.findByText('m.gomez');

    // Fila pending_registration tiene 3 botones: [0]=Suspender, [1]=Reenviar email, [2]=Dar de baja
    const rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[1]);

    // Verifica maskEmail('maria.gomez@itapu.edu.ar') -> 'ma*********@itapu.edu.ar'
    expect(await screen.findByText('ma*********@itapu.edu.ar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Reenviar$/i }));

    await waitFor(
      () => {
        expect(studentsApi.resendWelcome).toHaveBeenCalledWith('stu-2');
        expect(screen.queryByText(/Reenviar email de bienvenida/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('debería pedir contraseña para dar de baja cuenta con password y permitir baja directa sin password', async () => {
    vi.mocked(studentsApi.findAll)
      .mockResolvedValueOnce({ data: [studentActiveWithPass, studentPendingNoPass], total: 2 })
      .mockResolvedValueOnce({ data: [studentPendingNoPass], total: 1 })
      .mockResolvedValueOnce({ data: [], total: 0 });
    vi.mocked(studentsApi.remove).mockResolvedValue(undefined);

    const { container } = renderPadron();
    await screen.findByText('j.perez');

    // 1. Baja de cuenta CON contraseña (stu-1)
    const firstRowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(firstRowButtons[1]);

    const passInput = await screen.findByLabelText(/Contraseña del alumno/i);
    fireEvent.change(passInput, { target: { value: 'ClaveAlumno123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    await waitFor(
      () => {
        expect(studentsApi.remove).toHaveBeenCalledWith('stu-1', { password: 'ClaveAlumno123' });
        expect(screen.queryByText('j.perez')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // 2. Baja directa de cuenta SIN contraseña (stu-2)
    const remainingRowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(remainingRowButtons[2]);

    expect(await screen.findByText(/Esta cuenta no tiene contraseña configurada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    await waitFor(
      () => {
        expect(studentsApi.remove).toHaveBeenCalledWith('stu-2', { password: undefined });
        expect(screen.queryByText('m.gomez')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('debería mostrar modal de conflicto 409 cuando el usuario es responsable de apps', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({
      data: [studentActiveWithPass],
      total: 1,
    });

    const conflictError = {
      response: {
        status: 409,
        data: {
          statusCode: 409,
          message: 'No es posible eliminar a este usuario porque es responsable de apps OAuth.',
          responsibleApps: [
            { id: 10, clientName: 'Torneito App' },
            { id: 20, clientName: 'Visor PDF Exámenes' },
          ] as ResponsibleApp[],
        },
      },
    };
    vi.mocked(studentsApi.remove).mockRejectedValueOnce(conflictError);

    const { container } = renderPadron();
    await screen.findByText('j.perez');

    // Click en "Dar de baja"
    const rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[1]); // Dar de baja

    // Ingresar contraseña y confirmar
    const passInput = await screen.findByLabelText(/Contraseña del alumno/i);
    fireEvent.change(passInput, { target: { value: 'ClaveAlumno123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    // Modal de conflicto aparece
    expect(await screen.findByText(/No se puede eliminar este usuario/i)).toBeInTheDocument();
    expect(screen.getByText('Torneito App')).toBeInTheDocument();
    expect(screen.getByText('Visor PDF Exámenes')).toBeInTheDocument();

    // Cerrar modal de conflicto
    fireEvent.click(screen.getByRole('button', { name: /^Entendido$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/No se puede eliminar este usuario/i)).not.toBeInTheDocument();
    });
  });

  // ── Límites de intentos / requests (429) ────────────────────────────────────
  async function openDeleteModalWithPassword(container: HTMLElement) {
    const rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[1]); // Dar de baja
    const passInput = await screen.findByLabelText(/Contraseña del alumno/i);
    fireEvent.change(passInput, { target: { value: 'ClaveAlumno123' } });
  }

  const throttled = (seconds: string) => ({
    response: { status: 429, headers: { 'retry-after': seconds }, data: { message: 'ThrottlerException: Too Many Requests' } },
  });

  it('debería avisar que hay que esperar y bloquear el botón cuando el backend responde 429 por demasiados requests', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.remove).mockRejectedValue(throttled('30'));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);

    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/peticiones demasiado rápido/i);
    expect(alert).toHaveTextContent(/30 segundos/i);
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeDisabled();

    // Mientras dura la espera, ni el botón ni la tecla Enter vuelven a llamar al backend
    fireEvent.keyDown(screen.getByLabelText(/Contraseña del alumno/i), { key: 'Enter' });
    expect(studentsApi.remove).toHaveBeenCalledTimes(1);
  });

  it('debería explicar que el alumno quedó bloqueado por intentos de contraseña y mostrar la espera en minutos', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.remove).mockRejectedValue({
      response: {
        status: 429,
        headers: {},
        data: { statusCode: 429, code: 'PASSWORD_ATTEMPTS_LOCKED', retryAfterSeconds: 900, message: 'bloqueado' },
      },
    });

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);

    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/máximo de intentos de contraseña/i);
    expect(alert).toHaveTextContent(/15 minutos/i);
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeDisabled();
  });

  it('debería descontar la espera cada segundo y volver a habilitar el botón al terminar', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.remove).mockRejectedValueOnce(throttled('2'));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);

    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 segundos/i);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/1 segundo\b/i), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeEnabled();
  }, 10000);

  it('no debería arrastrar la espera al abrir el modal de baja de nuevo', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.remove).mockRejectedValueOnce(throttled('60'));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);
    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    await waitFor(() => expect(screen.queryByLabelText(/Contraseña del alumno/i)).not.toBeInTheDocument());

    const rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[1]);
    await screen.findByLabelText(/Contraseña del alumno/i);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeEnabled();
  });

  // ── Cooldown inmediato e intentos restantes ─────────────────────────────────

  const wrongPassword = (attemptsRemaining: number, retryAfterSeconds = 900) => ({
    response: {
      status: 403,
      data: { statusCode: 403, message: 'La contraseña ingresada es incorrecta.', attemptsRemaining, retryAfterSeconds },
    },
  });

  it('debería mostrar el cooldown apenas se abre el modal si el alumno ya está bloqueado, sin intentar la baja', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.getPasswordLock).mockResolvedValue({ locked: true, retryAfterSeconds: 600 });

    const { container } = renderPadron();
    await screen.findByText('j.perez');

    const rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[1]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/máximo de intentos de contraseña/i);
    expect(alert).toHaveTextContent(/10 minutos/i);
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeDisabled();
    expect(studentsApi.getPasswordLock).toHaveBeenCalledWith('stu-1');
    expect(studentsApi.remove).not.toHaveBeenCalled();
  });

  it('no debería mostrar cooldown ni consultar el bloqueo si el alumno no tiene contraseña', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentPendingNoPass], total: 1 });

    const { container } = renderPadron();
    await screen.findByText('m.gomez');

    const rowButtons = container.querySelectorAll('tbody tr')[0].querySelectorAll('button');
    fireEvent.click(rowButtons[2]); // Dar de baja

    await screen.findByText(/Esta cuenta no tiene contraseña configurada/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(studentsApi.getPasswordLock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeEnabled();
  });

  it('debería mantener el botón deshabilitado mientras se consulta el bloqueo', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    let resolveLock!: (v: { locked: boolean; retryAfterSeconds: number }) => void;
    vi.mocked(studentsApi.getPasswordLock).mockReturnValue(new Promise(r => { resolveLock = r; }));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    fireEvent.click(container.querySelectorAll('tbody tr')[0].querySelectorAll('button')[1]);

    await screen.findByLabelText(/Contraseña del alumno/i);
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeDisabled();

    await act(async () => { resolveLock({ locked: false, retryAfterSeconds: 0 }); });
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeEnabled();
  });

  it('debería seguir permitiendo intentar si falla la consulta del bloqueo', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.getPasswordLock).mockRejectedValue(new Error('red'));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    fireEvent.click(container.querySelectorAll('tbody tr')[0].querySelectorAll('button')[1]);

    await screen.findByLabelText(/Contraseña del alumno/i);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeEnabled());
  });

  it('debería informar cuántos intentos quedan después de una contraseña incorrecta', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.remove)
      .mockRejectedValueOnce(wrongPassword(4))
      .mockRejectedValueOnce(wrongPassword(1));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);

    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));
    expect(await screen.findByText(/Te quedan 4 intentos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));
    expect(await screen.findByText(/Te queda 1 intento\./i)).toBeInTheDocument();
  });

  it('debería mostrar el cooldown en el mismo momento en que se agota el último intento', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.remove).mockRejectedValueOnce(wrongPassword(0, 900));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);

    fireEvent.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/máximo de intentos de contraseña/i);
    expect(alert).toHaveTextContent(/15 minutos/i);
    expect(screen.getByRole('button', { name: /^Dar de baja$/i })).toBeDisabled();
    expect(studentsApi.remove).toHaveBeenCalledTimes(1);
  });

  it('no debería enviar la baja dos veces si se aprieta Enter mientras la primera sigue en curso', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    let finish!: () => void;
    vi.mocked(studentsApi.remove).mockReturnValue(new Promise<void>(r => { finish = r; }));

    const { container } = renderPadron();
    await screen.findByText('j.perez');
    await openDeleteModalWithPassword(container);

    const input = screen.getByLabelText(/Contraseña del alumno/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(studentsApi.remove).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
  });

  // ── Cambio de email ─────────────────────────────────────────────────────────

  const studentSuspended: StudentResponse = {
    ...studentActiveWithPass,
    id: 'stu-3',
    username: 's.lopez',
    first_name: 'Sofía',
    last_name: 'López',
    account_status: 'suspended',
  };

  async function openEmailModal() {
    fireEvent.click(await screen.findByRole('button', { name: /^Cambiar email$/i }));
    await screen.findByLabelText(/Nuevo email/i);
  }

  function fillEmailForm(email: string, password: string) {
    fireEvent.change(screen.getByLabelText(/Nuevo email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/Contraseña del alumno/i), { target: { value: password } });
  }

  const submitEmailChange = () =>
    fireEvent.click(screen.getByRole('button', { name: /Enviar link de confirmación/i }));

  it('debería mostrar el lápiz solo en alumnos activos (no en suspendidos ni pendientes)', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({
      data: [studentPendingNoPass, studentSuspended],
      total: 2,
    });
    renderPadron();
    await screen.findByText('m.gomez');
    expect(screen.queryByRole('button', { name: /^Cambiar email$/i })).not.toBeInTheDocument();

    vi.mocked(studentsApi.findAll).mockResolvedValue({
      data: [studentPendingNoPass, studentActiveWithPass, studentSuspended],
      total: 3,
    });
    fireEvent.change(screen.getByPlaceholderText(/Usuario, nombre o DNI/i), { target: { value: 'j' } });

    await screen.findByText('j.perez');
    const buttons = screen.getAllByRole('button', { name: /^Cambiar email$/i });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('tr')).toHaveTextContent('j.perez');
  });

  it('debería pedir el cambio con el email nuevo y la contraseña, y avisar a dónde se envió el link', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.requestEmailChange).mockResolvedValue(undefined);

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();

    // Muestra el email actual enmascarado
    expect(screen.getByText('ju********@itapu.edu.ar')).toBeInTheDocument();

    fillEmailForm('  nuevo.mail@gmail.com ', 'ClaveAlumno123');
    submitEmailChange();

    await waitFor(() =>
      expect(studentsApi.requestEmailChange).toHaveBeenCalledWith('stu-1', {
        password: 'ClaveAlumno123',
        newEmail: 'nuevo.mail@gmail.com',
      }),
    );
    expect(await screen.findByText('nu********@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/hasta 15 minutos/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Contraseña del alumno/i)).not.toBeInTheDocument();
  });

  it.each([
    ['un email inválido', 'no-es-un-email', 'ClaveAlumno123', /Ingresá un email válido/i],
    ['el mismo email (sin importar mayúsculas)', 'JUAN.PEREZ@itapu.edu.ar', 'ClaveAlumno123', /igual al actual/i],
    ['sin contraseña', 'nuevo@gmail.com', '', /Ingresá la contraseña del alumno/i],
  ])('debería validar antes de enviar: %s', async (_label, email, password, message) => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm(email, password);
    submitEmailChange();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(studentsApi.requestEmailChange).not.toHaveBeenCalled();
  });

  it('debería informar cuántos intentos quedan si la contraseña es incorrecta (y no cerrar el modal)', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.requestEmailChange)
      .mockRejectedValueOnce(wrongPassword(4))
      .mockRejectedValueOnce(wrongPassword(1));

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm('nuevo@gmail.com', 'mala');

    submitEmailChange();
    expect(await screen.findByText(/Te quedan 4 intentos/i)).toBeInTheDocument();

    submitEmailChange();
    expect(await screen.findByText(/Te queda 1 intento\./i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nuevo email/i)).toBeInTheDocument();
  });

  it('debería mostrar el cooldown en el mismo momento en que se agota el último intento', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.requestEmailChange).mockRejectedValueOnce(wrongPassword(0, 900));

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm('nuevo@gmail.com', 'mala');
    submitEmailChange();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/máximo de intentos de contraseña/i);
    expect(alert).toHaveTextContent(/15 minutos/i);
    expect(screen.getByRole('button', { name: /Enviar link de confirmación/i })).toBeDisabled();
  });

  it('debería mostrar el cooldown apenas se abre el modal si el alumno ya está bloqueado', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.getPasswordLock).mockResolvedValue({ locked: true, retryAfterSeconds: 600 });

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/10 minutos/i);
    expect(screen.getByRole('button', { name: /Enviar link de confirmación/i })).toBeDisabled();
    expect(studentsApi.getPasswordLock).toHaveBeenCalledWith('stu-1');
    expect(studentsApi.requestEmailChange).not.toHaveBeenCalled();
  });

  it('debería explicar que hay que esperar si el backend responde 429 por demasiados requests', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.requestEmailChange).mockRejectedValueOnce(throttled('30'));

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm('nuevo@gmail.com', 'ClaveAlumno123');
    submitEmailChange();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/peticiones demasiado rápido/i);
    expect(alert).toHaveTextContent(/30 segundos/i);
  });

  it('debería mostrar el mensaje del servidor si el email ya está registrado (409)', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.requestEmailChange).mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Ese email ya está registrado por otro usuario.' } },
    });

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm('otro@gmail.com', 'ClaveAlumno123');
    submitEmailChange();

    expect(await screen.findByText(/Ese email ya está registrado por otro usuario/i)).toBeInTheDocument();
  });

  it('debería unir los mensajes de validación cuando el servidor devuelve una lista', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    vi.mocked(studentsApi.requestEmailChange).mockRejectedValueOnce({
      response: { status: 400, data: { message: ['newEmail must be an email', 'password should not be empty'] } },
    });

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm('nuevo@gmail.com', 'x');
    submitEmailChange();

    expect(await screen.findByText(/newEmail must be an email password should not be empty/i)).toBeInTheDocument();
  });

  it('no debería enviar el pedido dos veces si se aprieta Enter mientras el primero sigue en curso', async () => {
    vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
    let finish!: () => void;
    vi.mocked(studentsApi.requestEmailChange).mockReturnValue(new Promise<void>(r => { finish = r; }));

    renderPadron();
    await screen.findByText('j.perez');
    await openEmailModal();
    fillEmailForm('nuevo@gmail.com', 'ClaveAlumno123');

    const input = screen.getByLabelText(/Contraseña del alumno/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(studentsApi.requestEmailChange).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
  });

  describe('Editar usuario', () => {
    it('debería mostrar cargos y especialidades como etiquetas', async () => {
      vi.mocked(studentsApi.findAll).mockResolvedValue({
        data: [{ ...studentActiveWithPass, domainRoles: [{ id: 3, name: 'Preceptor' }, { id: 4, name: 'Profesor' }] }],
        total: 1,
      });
      renderPadron();
      expect(await screen.findByText('Preceptor')).toBeInTheDocument();
      expect(screen.getByText('Profesor')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Cargos' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Especialidades' })).toBeInTheDocument();
    });

    it('debería abrir el modal, guardar con la contraseña del admin y recargar el padrón', async () => {
      vi.mocked(studentsApi.findAll).mockResolvedValue({ data: [studentActiveWithPass], total: 1 });
      vi.mocked(studentsApi.update).mockResolvedValueOnce({ ...studentActiveWithPass, first_name: 'Juan Carlos' });

      renderPadron();
      fireEvent.click(await screen.findByRole('button', { name: 'Editar usuario' }));

      const nameInput = await screen.findByLabelText(/Nombre\/s/);
      expect(nameInput).toHaveValue('Juan');
      fireEvent.change(nameInput, { target: { value: 'Juan Carlos' } });
      fireEvent.change(screen.getByLabelText(/Tu contraseña de administrador/), { target: { value: 'admin-pass' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

      expect(await screen.findByText(/Se guardaron los cambios de Juan Carlos Pérez/)).toBeInTheDocument();
      expect(studentsApi.update).toHaveBeenCalledWith('stu-1', { first_name: 'Juan Carlos', admin_password: 'admin-pass' });
      await waitFor(() => expect(studentsApi.findAll).toHaveBeenCalledTimes(2));
    });
  });
});

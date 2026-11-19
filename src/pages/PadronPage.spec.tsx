import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    resendWelcome: vi.fn(),
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
  email: 'juan.perez@frvm.utn.edu.ar',
  dni: 40123456,
  birth_date: '2000-05-10',
  account_status: 'active',
  hasPassword: true,
  domainRole: { id: 1, name: 'Alumno' },
  specialty: { id: 1, name: 'Sistemas' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const studentPendingNoPass: StudentResponse = {
  id: 'stu-2',
  username: 'm.gomez',
  first_name: 'María',
  last_name: 'Gómez',
  email: 'maria.gomez@frvm.utn.edu.ar',
  dni: 41987654,
  birth_date: '2001-08-20',
  account_status: 'pending_registration',
  hasPassword: false,
  domainRole: { id: 1, name: 'Alumno' },
  specialty: { id: 2, name: 'Química' },
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
    vi.mocked(rolesApi.findAll).mockResolvedValue([
      { id: 1, name: 'Alumno', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
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

    fireEvent.change(screen.getByPlaceholderText(/Buscar\.\.\./i), { target: { value: 'Pérez' } });

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

    // Verifica maskEmail('maria.gomez@frvm.utn.edu.ar') -> 'ma*********@frvm.utn.edu.ar'
    expect(await screen.findByText('ma*********@frvm.utn.edu.ar')).toBeInTheDocument();

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
            { id: 20, clientName: 'Autogestión' },
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
    expect(screen.getByText('Autogestión')).toBeInTheDocument();

    // Cerrar modal de conflicto
    fireEvent.click(screen.getByRole('button', { name: /^Entendido$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/No se puede eliminar este usuario/i)).not.toBeInTheDocument();
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { CargarUsuariosPage } from './CargarUsuariosPage';
import { studentsApi } from '@/api/studentsApi';
import { rolesApi } from '@/api/rolesApi';
import { specialtiesApi } from '@/api/specialtiesApi';

vi.mock('@/api/studentsApi', () => ({
  studentsApi: {
    create: vi.fn(),
    importPreview: vi.fn(),
    importConfirm: vi.fn(),
    downloadExampleXlsx: vi.fn(),
  },
}));

vi.mock('@/api/rolesApi', () => ({
  rolesApi: { findAll: vi.fn() },
}));

vi.mock('@/api/specialtiesApi', () => ({
  specialtiesApi: { findAll: vi.fn() },
}));

function renderCargarUsuarios() {
  return render(
    <MantineProvider>
      <CargarUsuariosPage />
    </MantineProvider>,
  );
}

describe('CargarUsuariosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rolesApi.findAll).mockResolvedValue([
      { id: 1, name: 'Alumno', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    vi.mocked(specialtiesApi.findAll).mockResolvedValue([
      { id: 2, name: 'Sistemas', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
  });

  it('debería registrar un usuario de forma individual y limpiar el formulario', async () => {
    vi.mocked(studentsApi.create).mockResolvedValueOnce({
      id: 'stu-1',
      username: 'i.mosconi',
      first_name: 'Ignacio Mariano',
      last_name: 'Mosconi',
      dni: 44244136,
      email: 'ignacio@itapu.edu.ar',
      birth_date: '2002-05-15',
      account_status: 'pending_registration',
      hasPassword: false,
      domainRole: { id: 1, name: 'Alumno' },
      specialty: { id: 2, name: 'Sistemas' },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    renderCargarUsuarios();

    await waitFor(() => {
      expect(rolesApi.findAll).toHaveBeenCalled();
      expect(specialtiesApi.findAll).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText(/Nombres/i), { target: { value: 'Ignacio Mariano' } });
    fireEvent.change(screen.getByLabelText(/Apellidos/i), { target: { value: 'Mosconi' } });
    fireEvent.change(screen.getByLabelText(/DNI/i), { target: { value: '44244136' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ignacio@itapu.edu.ar' } });
    fireEvent.change(screen.getByLabelText(/Fecha de nacimiento/i), { target: { value: '2002-05-15' } });

    const rolSelect = screen.getByRole('combobox', { name: /Cargo institucional/i });
    fireEvent.keyDown(rolSelect, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'Alumno', hidden: true }));

    const espSelect = screen.getByRole('combobox', { name: /Especialidad/i });
    fireEvent.keyDown(espSelect, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'Sistemas', hidden: true }));

    fireEvent.click(screen.getByRole('button', { name: /Registrar usuario/i }));

    expect(
      await screen.findByText(/Usuario creado con nombre de usuario: i\.mosconi/i),
    ).toBeInTheDocument();
    expect(studentsApi.create).toHaveBeenCalledWith({
      first_name: 'Ignacio Mariano',
      last_name: 'Mosconi',
      dni: 44244136,
      email: 'ignacio@itapu.edu.ar',
      birth_date: '2002-05-15',
      domain_role_id: 1,
      specialty_id: 2,
    });
  });

  it('debería validar formato de archivo en carga masiva, previsualizar filas y confirmar importación', async () => {
    vi.mocked(studentsApi.downloadExampleXlsx).mockResolvedValueOnce(undefined);
    vi.mocked(studentsApi.importPreview).mockResolvedValueOnce({
      total: 2,
      valid: 1,
      invalid: 1,
      rows: [
        {
          rowNumber: 2,
          valid: true,
          data: {
            first_name: 'Ana',
            last_name: 'López',
            dni: 40111222,
            email: 'ana@itapu.edu.ar',
            birth_date: '2001-03-10',
            domainRoleId: 1,
            specialtyId: 2,
          },
          errors: [],
        },
        {
          rowNumber: 3,
          valid: false,
          data: {
            first_name: 'Carlos',
            last_name: 'Ruiz',
            dni: 123,
            email: 'mal-email',
          },
          errors: ['DNI inválido', 'Email inválido'],
        },
      ],
    });
    vi.mocked(studentsApi.importConfirm).mockResolvedValueOnce({
      imported: 1,
      usernameCollisions: 1,
    });

    const { container } = renderCargarUsuarios();

    fireEvent.click(screen.getByRole('tab', { name: /Carga masiva/i }));

    // 1. Descargar Excel de ejemplo
    fireEvent.click(await screen.findByRole('button', { name: /Descargar Excel de ejemplo/i }));
    await waitFor(() => {
      expect(studentsApi.downloadExampleXlsx).toHaveBeenCalled();
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // 2. Archivo con extensión inválida (.csv)
    const badFile = new File(['a,b,c'], 'padron.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(
      await screen.findByText(/Formato no válido\. Solo se permiten archivos de Excel/i),
    ).toBeInTheDocument();

    // 3. Archivo Excel válido (.xlsx)
    const validFile = new File(['dummy-xlsx'], 'padron_2026.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(await screen.findByRole('button', { name: /padron_2026\.xlsx/i })).toBeInTheDocument();

    // 4. Previsualizar
    fireEvent.click(screen.getByRole('button', { name: /Previsualizar/i }));

    expect(await screen.findByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.getByText('DNI inválido; Email inválido')).toBeInTheDocument();

    // 5. Confirmar importación de filas válidas
    fireEvent.click(screen.getByRole('button', { name: /Importar 1 fila\(s\) válida\(s\)/i }));

    expect(
      await screen.findByText(/Importación completada: 1 usuario\(s\) creados\. 1 nombre\(s\) de usuario ajustado\(s\) por colisión\./i),
    ).toBeInTheDocument();
    expect(studentsApi.importConfirm).toHaveBeenCalledWith({
      rows: [
        {
          first_name: 'Ana',
          last_name: 'López',
          dni: 40111222,
          email: 'ana@itapu.edu.ar',
          birth_date: '2001-03-10',
          domainRoleId: 1,
          specialtyId: 2,
        },
      ],
    });
  });
});
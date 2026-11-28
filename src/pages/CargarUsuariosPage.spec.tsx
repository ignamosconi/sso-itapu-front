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
      { id: 1, name: 'Alumno', exclusive: true, singleSpecialty: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
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
      dni: 30123456,
      email: 'ignacio@itapu.edu.ar',
      birth_date: '2002-05-15',
      account_status: 'pending_registration',
      hasPassword: false,
      domainRoles: [{ id: 1, name: 'Alumno' }],
      specialties: [{ id: 2, name: 'Sistemas' }],
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
    fireEvent.change(screen.getByLabelText(/DNI/i), { target: { value: '30123456' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ignacio@itapu.edu.ar' } });
    fireEvent.change(screen.getByLabelText(/Fecha de nacimiento/i), { target: { value: '2002-05-15' } });

    const rolSelect = screen.getByRole('combobox', { name: /Cargos institucionales/i });
    fireEvent.keyDown(rolSelect, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: /^Alumno/, hidden: true }));

    const espSelect = screen.getByRole('combobox', { name: /Especialidades/i });
    fireEvent.keyDown(espSelect, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'Sistemas', hidden: true }));

    fireEvent.click(screen.getByRole('button', { name: /Registrar usuario/i }));

    expect(
      await screen.findByText(/Usuario creado con nombre de usuario: i\.mosconi/i),
    ).toBeInTheDocument();
    expect(studentsApi.create).toHaveBeenCalledWith({
      first_name: 'Ignacio Mariano',
      last_name: 'Mosconi',
      dni: 30123456,
      email: 'ignacio@itapu.edu.ar',
      birth_date: '2002-05-15',
      domain_role_ids: [1],
      specialty_ids: [2],
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
            domainRoleIds: [1],
            specialtyIds: [2],
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
            domain_role: 'Alumno; Profesor',
            specialty: 'Sistemas',
          },
          errors: ['DNI inválido', 'Email inválido', 'Reglas del cargo: El cargo "Alumno" no se puede combinar con otros cargos.'],
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

    // 2b. Archivo Excel de más de 5 MB: se rechaza en el navegador, sin subirlo
    const hugeFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'enorme.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(fileInput, { target: { files: [hugeFile] } });
    expect(await screen.findByText(/El archivo supera el máximo de 5 MB/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previsualizar/i })).toBeDisabled();

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
    expect(screen.getByText(/DNI inválido; Email inválido; Reglas del cargo/)).toBeInTheDocument();
    // Fila válida: ids traducidos a nombres. Fila inválida: el texto tal como venía en el Excel.
    expect(screen.getByRole('cell', { name: 'Alumno' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alumno; Profesor' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: 'Sistemas' })).toHaveLength(2);

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
          domainRoleIds: [1],
          specialtyIds: [2],
        },
      ],
    });
  });

  it('debería avisar y no dejar registrar si la combinación de cargos no cumple las reglas', async () => {
    vi.mocked(rolesApi.findAll).mockResolvedValue([
      { id: 1, name: 'Alumno', exclusive: true, singleSpecialty: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 3, name: 'Profesor', exclusive: false, singleSpecialty: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    renderCargarUsuarios();
    await waitFor(() => expect(rolesApi.findAll).toHaveBeenCalled());

    const rolSelect = screen.getByRole('combobox', { name: /Cargos institucionales/i });
    fireEvent.keyDown(rolSelect, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /^Alumno/, hidden: true }));
    fireEvent.keyDown(rolSelect, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /^Profesor/, hidden: true }));

    const espSelect = screen.getByRole('combobox', { name: /Especialidades/i });
    fireEvent.keyDown(espSelect, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Sistemas', hidden: true }));

    expect(await screen.findByText(/no cumple las reglas de los cargos/i)).toBeInTheDocument();
    expect(screen.getByText(/El cargo "Alumno" no se puede combinar con otros cargos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar usuario/i })).toBeDisabled();
    expect(studentsApi.create).not.toHaveBeenCalled();
  });
  it('el desplegable de cargos se cierra al elegir uno que no se combina y queda abierto con uno que se combina', async () => {
    vi.mocked(rolesApi.findAll).mockResolvedValue([
      { id: 1, name: 'Alumno', exclusive: true, singleSpecialty: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 3, name: 'Profesor', exclusive: false, singleSpecialty: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    renderCargarUsuarios();
    await waitFor(() => expect(rolesApi.findAll).toHaveBeenCalled());

    const rolSelect = screen.getByRole('combobox', { name: /Cargos institucionales/i });
    fireEvent.click(rolSelect);
    fireEvent.click(await screen.findByRole('option', { name: /^Profesor/, hidden: true }));
    expect(rolSelect).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(await screen.findByRole('option', { name: /^Alumno/, hidden: true }));
    expect(rolSelect).toHaveAttribute('aria-expanded', 'false');
  });
});

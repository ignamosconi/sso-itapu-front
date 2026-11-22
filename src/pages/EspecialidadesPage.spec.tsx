import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EspecialidadesPage } from './EspecialidadesPage';
import { specialtiesApi } from '@/api/specialtiesApi';

vi.mock('@/api/specialtiesApi', () => ({
  specialtiesApi: {
    findAll: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

function renderEspecialidades() {
  return render(
    <MantineProvider>
      <EspecialidadesPage />
    </MantineProvider>,
  );
}

describe('EspecialidadesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería listar especialidades y filtrar por nombre', async () => {
    vi.mocked(specialtiesApi.findAll).mockResolvedValueOnce([
      { id: 1, name: 'Ingeniería en Sistemas', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Ingeniería Química', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    ]);

    renderEspecialidades();

    expect(await screen.findByText('Ingeniería en Sistemas')).toBeInTheDocument();
    expect(screen.getByText('Ingeniería Química')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/i), {
      target: { value: 'Química' },
    });

    expect(screen.queryByText('Ingeniería en Sistemas')).not.toBeInTheDocument();
    expect(screen.getByText('Ingeniería Química')).toBeInTheDocument();
  });

  it('debería filtrar ignorando tildes y mayúsculas, en ambos sentidos', async () => {
    vi.mocked(specialtiesApi.findAll).mockResolvedValueOnce([
      { id: 1, name: 'Ingeniería Química', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 2, name: 'Mecanica', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    ]);

    renderEspecialidades();
    await screen.findByText('Ingeniería Química');
    const input = screen.getByPlaceholderText(/Buscar por nombre/i);

    fireEvent.change(input, { target: { value: 'quimica' } });
    expect(screen.getByText('Ingeniería Química')).toBeInTheDocument();
    expect(screen.queryByText('Mecanica')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'MECÁNICA' } });
    expect(screen.getByText('Mecanica')).toBeInTheDocument();
    expect(screen.queryByText('Ingeniería Química')).not.toBeInTheDocument();
  });

  it('debería crear y eliminar una especialidad correctamente', async () => {
    vi.mocked(specialtiesApi.findAll)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 5, name: 'Electrónica', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' }])
      .mockResolvedValueOnce([]);
    vi.mocked(specialtiesApi.create).mockResolvedValueOnce({ id: 5, name: 'Electrónica', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' });
    vi.mocked(specialtiesApi.remove).mockResolvedValueOnce(undefined);

    const { container } = renderEspecialidades();

    // Crear
    fireEvent.click(await screen.findByRole('button', { name: /Nueva especialidad/i }));
    fireEvent.change(await screen.findByLabelText(/Nombre/i), { target: { value: 'Electrónica' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear especialidad/i }));

    expect(await screen.findByText('Electrónica')).toBeInTheDocument();

    // Eliminar
    const trashBtn = container.querySelector('tbody button');
    expect(trashBtn).not.toBeNull();
    fireEvent.click(trashBtn!);
    fireEvent.click(await screen.findByRole('button', { name: /^Eliminar$/i }));

    await waitFor(() => {
      expect(specialtiesApi.remove).toHaveBeenCalledWith(5);
      expect(screen.queryByText('Electrónica')).not.toBeInTheDocument();
    });
  });

  it('debería mostrar alerta si falla la carga inicial', async () => {
    vi.mocked(specialtiesApi.findAll).mockRejectedValueOnce(new Error('Error'));
    renderEspecialidades();

    expect(await screen.findByText(/Error al cargar las especialidades\./i)).toBeInTheDocument();
  });
});
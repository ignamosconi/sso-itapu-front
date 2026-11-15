import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DashboardPage } from './DashboardPage';
import { healthApi } from '@/api/healthApi';
import { statsApi } from '@/api/statsApi';

vi.mock('@/api/healthApi', () => ({
  healthApi: {
    checkSso: vi.fn(),
  },
}));

vi.mock('@/api/statsApi', () => ({
  statsApi: {
    getDashboard: vi.fn(),
  },
}));

function renderDashboard() {
  return render(
    <MantineProvider>
      <DashboardPage />
    </MantineProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería mostrar métricas, gráfico por especialidad y estado En línea cuando el SSO responde', async () => {
    vi.mocked(healthApi.checkSso).mockResolvedValue(true);
    vi.mocked(statsApi.getDashboard).mockResolvedValue({
      studentCount: 142,
      pendingRegistrationCount: 18,
      oauthClientCount: 4,
      studentsBySpecialty: [
        { specialty: 'Ingeniería en Sistemas', count: 90 },
        { specialty: 'Ingeniería Química', count: 52 },
      ],
    });

    renderDashboard();

    expect(await screen.findByText('142')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Ingeniería en Sistemas')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
  });

  it('debería mostrar Sin conexión y estado vacío en el gráfico cuando corresponde', async () => {
    vi.mocked(healthApi.checkSso).mockResolvedValue(false);
    vi.mocked(statsApi.getDashboard).mockResolvedValue({
      studentCount: 0,
      pendingRegistrationCount: 0,
      oauthClientCount: 0,
      studentsBySpecialty: [],
    });

    renderDashboard();

    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText('No hay datos disponibles.')).toBeInTheDocument();
  });

  it('debería forzar actualización de estadísticas al presionar el botón refresh y respetar el cooldown', async () => {
    vi.mocked(healthApi.checkSso).mockResolvedValue(true);
    vi.mocked(statsApi.getDashboard).mockResolvedValue({
      studentCount: 10,
      pendingRegistrationCount: 2,
      oauthClientCount: 1,
      studentsBySpecialty: [],
    });

    const { container } = renderDashboard();
    await screen.findByText('10');

    const refreshBtn = container.querySelector('button');
    expect(refreshBtn).not.toBeNull();

    fireEvent.click(refreshBtn!);

    await waitFor(() => {
      expect(statsApi.getDashboard).toHaveBeenCalledWith(true);
    });
    expect(refreshBtn).toBeDisabled();
  });
});
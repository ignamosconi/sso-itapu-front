import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { MantineProvider } from '@mantine/core';

const renderWithMantine = (ui: React.ReactElement) =>
  render(<MantineProvider>{ui}</MantineProvider>);

// Sustituimos Navigate por un marcador para poder hacer assertions
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Navigate: vi.fn(({ to }: { to: string }) => (
      <div data-testid="redirect" data-to={to} />
    )),
  };
});

const resetStore = () =>
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    pendingToken: null,
    isAuthenticated: false,
    adminId: null,
    adminUsername: null,
    isBootstrapping: false,
  });

describe('ProtectedRoute', () => {
  beforeEach(resetStore);

  it('debería mostrar el loader mientras el bootstrap está en curso', () => {
    useAuthStore.setState({ isBootstrapping: true });

    renderWithMantine(
      <ProtectedRoute>
        <div data-testid="children">contenido protegido</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Verificando sesión...')).toBeInTheDocument();
    expect(screen.queryByTestId('children')).not.toBeInTheDocument();
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
  });

  it('debería redirigir a /login si no está autenticado', () => {
    useAuthStore.setState({ isAuthenticated: false, accessToken: null });

    renderWithMantine(
      <ProtectedRoute>
        <div data-testid="children">contenido protegido</div>
      </ProtectedRoute>,
    );

    const redirect = screen.getByTestId('redirect');
    expect(redirect).toBeInTheDocument();
    expect(redirect).toHaveAttribute('data-to', '/login');
    expect(screen.queryByTestId('children')).not.toBeInTheDocument();
  });

  it('debería redirigir a /login si isAuthenticated es true pero no hay accessToken en memoria', () => {
    // isAuthenticated puede quedar en sessionStorage pero accessToken no se persiste
    useAuthStore.setState({ isAuthenticated: true, accessToken: null });

    renderWithMantine(
      <ProtectedRoute>
        <div data-testid="children">contenido protegido</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/login');
  });

  it('debería renderizar los children si está autenticado y tiene accessToken', () => {
    useAuthStore.setState({ isAuthenticated: true, accessToken: 'valid-token' });

    renderWithMantine(
      <ProtectedRoute>
        <div data-testid="children">contenido protegido</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
  });
});
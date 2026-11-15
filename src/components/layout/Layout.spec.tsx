//Este test cubre Appshell.tsx & Navbar.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Navbar } from './Navbar';
import { AppShell } from './AppShell';

const mockLogout = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

describe('Navbar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debería renderizar secciones, desplegar submenús y cerrar sesión', async () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();
    mockLogout.mockResolvedValueOnce(undefined);

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={<Navbar isOpen={true} onToggle={onToggle} onClose={onClose} isMobile={false} />}
            />
            <Route path="/login" element={<div>Login Mock</div>} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByText('SSO FRVM')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clientes OAuth')).toBeInTheDocument();

    // Desplegar submenú Usuarios
    fireEvent.click(screen.getByText('Usuarios'));
    expect(screen.getByText('Padrón')).toBeInTheDocument();

    // Cerrar sesión
    fireEvent.click(screen.getByText('Cerrar sesión'));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Login Mock')).toBeInTheDocument();
    });
  });

  it('debería expandir el navbar al hacer click en un submenú estando colapsado', () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar isOpen={false} onToggle={onToggle} onClose={onClose} isMobile={false} />
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.queryByText('SSO FRVM')).not.toBeInTheDocument();

    // Click en botón del submenú estando colapsado dispara onToggle
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[2]);
    expect(onToggle).toHaveBeenCalled();
  });

  it('debería cerrar el menú en mobile al seleccionar un enlace', () => {
    const onToggle = vi.fn();
    const onClose = vi.fn();

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar isOpen={true} onToggle={onToggle} onClose={onClose} isMobile={true} />
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByText('FAQs'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AppShell', () => {
  it('debería renderizar el layout y el contenido de la ruta hija (Outlet)', () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<div>Contenido Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByText('Contenido Dashboard')).toBeInTheDocument();
  });
});
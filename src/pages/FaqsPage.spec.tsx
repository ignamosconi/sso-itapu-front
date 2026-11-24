import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { FaqsPage } from './FaqsPage';

function renderFaqs() {
  return render(
    <MantineProvider>
      <FaqsPage />
    </MantineProvider>,
  );
}

const open = (title: RegExp) => fireEvent.click(screen.getByRole('button', { name: title }));

describe('FaqsPage', () => {
  it('muestra las tres secciones', () => {
    renderFaqs();
    expect(screen.getByText('Integración SSO')).toBeInTheDocument();
    expect(screen.getByText('Uso de este panel')).toBeInTheDocument();
    expect(screen.getByText('Levantar los repositorios')).toBeInTheDocument();
  });

  it('el instructivo de integración pide client_id y client_secret en refresh y logout', () => {
    const { container } = renderFaqs();
    open(/Soy desarrollador\. ¿Cómo integro mi app con el SSO\?/i);
    const refresh = container.textContent ?? '';
    expect(refresh).toMatch(/\/sso\/refresh[\s\S]*"client_secret": "TU_SECRET"[\s\S]*"refresh_token"/);
    expect(refresh).toMatch(/\/sso\/logout[\s\S]*"client_secret": "TU_SECRET"[\s\S]*"refresh_token"/);
    expect(refresh).toContain('misma redirect_uri con la que se abrió el popup');
    expect(refresh).toContain('encodeURIComponent');
  });

  it('describe el popup actual: botón de primera vez / olvidé mi contraseña y bloqueo por intentos', () => {
    renderFaqs();
    open(/Soy desarrollador\. ¿Cómo integro mi app con el SSO\?/i);
    expect(screen.getAllByText(/Es mi primera vez \/ Olvidé mi contraseña/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/en dos pasos/i)).not.toBeInTheDocument();
  });

  it('explica las reglas de las redirect URIs y el bloqueo de localhost en producción', () => {
    renderFaqs();
    open(/Soy administrador\. ¿Cómo registro una nueva app/i);
    expect(screen.getByText(/usuario responsable/i)).toBeInTheDocument();
    expect(screen.getByText(/ALLOW_LOCALHOST_REDIRECTS=true/)).toBeInTheDocument();
  });

  it('incluye las preguntas sobre bloqueo de login, link de contraseña y límite de peticiones', () => {
    renderFaqs();
    expect(screen.getByRole('button', { name: /no puede iniciar sesión en una app/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link para crear su contraseña no funciona/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /estoy haciendo peticiones demasiado rápido/i })).toBeInTheDocument();
  });
});

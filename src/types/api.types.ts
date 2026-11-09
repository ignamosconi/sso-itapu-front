// ── Auth ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Respuesta del paso 1 del login (antes del 2FA)
export interface AdminLoginResponse {
  pending_token: string;
  requires_2fa_setup: boolean;
}

// Respuesta del setup de 2FA — QR + secret manual
export interface Admin2faSetupResponse {
  qrCodeDataUrl: string;
  manualEntrySecret: string;
  confirm_pending_token: string;        // Nuevo pending token con purpose 2fa-confirm, emitido por el backend después de consumir el token de setup. Usarlo en /2fa/confirm.
}
// ── Admins ───────────────────────────────────────────────────────────────────

export interface AdminResponse {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminPayload {
  username: string;
  password: string;
}

export interface UpdateAdminPayload {
  username?: string;
  password?: string;
}

export interface Reset2faPayload {
  password: string;
}

// ── OAuth Clients ────────────────────────────────────────────────────────────

// Respuesta general — sin clientSecret (el hash no sirve para nada en el front)
export interface OAuthClientResponse {
  id: number;
  clientName: string;
  redirectUris: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Respuesta de create y regenerate-secret — incluye el plainSecret una sola vez
export interface OAuthClientCreatedResponse {
  id: number;
  clientName: string;
  redirectUris: string[];
  plainSecret: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOAuthClientPayload {
  clientName: string;
  redirectUris: string[];
}

export interface UpdateOAuthClientPayload {
  clientName?: string;
  redirectUris?: string[];
}

// plainSecret es obligatorio — viene del create o regenerate inmediatamente antes
export interface SendCredentialsEmailPayload {
  to: string;
  // plainSecret eliminado: el backend lo recupera de Redis. El frontend solo necesita indicar el destinatario.
}
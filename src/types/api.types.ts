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
  currentPassword?: string;
}

export interface DeleteSelfPayload {
  password: string;
  confirmationPhrase: string;
}

export interface Reset2faPayload {
  password: string;
}

// ── Domain Roles ─────────────────────────────────────────────────────────────

export interface DomainRoleResponse {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDomainRolePayload {
  name: string;
}

// ── Specialties ───────────────────────────────────────────────────────────────

export interface SpecialtyResponse {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpecialtyPayload {
  name: string;
}

// ── Students ──────────────────────────────────────────────────────────────────

export interface StudentResponse {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  dni: number;
  birth_date: string;
  account_status: 'active' | 'suspended' | 'pending_registration';
  hasPassword: boolean;
  domainRole: { id: number; name: string };
  specialty: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedStudentsResponse {
  data: StudentResponse[];
  total: number;
}

export interface StudentFilters {
  search?: string;
  domainRoleId?: number;
  specialtyId?: number;
  accountStatus?: string;
  page?: number;
  limit?: number;
}

export interface CreateStudentPayload {
  first_name: string;
  last_name: string;
  email: string;
  dni: number;
  birth_date: string;
  domain_role_id: number;
  specialty_id: number;
}

export interface UpdateStudentPayload {
  first_name?: string;
  last_name?: string;
  dni?: number;
  birth_date?: string;
  domain_role_id?: number;
  specialty_id?: number;
}

export interface ResponsibleApp {
  id: number;
  clientName: string;
}

export interface DeleteStudentConflictError {
  statusCode: 409;
  message: string;
  responsibleApps: ResponsibleApp[];
}

export interface DeleteStudentPayload {
  password?: string;
}

// Estado del bloqueo por intentos de contraseña de un alumno (baja del padrón)
export interface PasswordLockStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  valid: boolean;
  errors?: string[];
  data: Record<string, unknown>;
}

export interface ImportPreviewResult {
  total: number;
  valid: number;
  invalid: number;
  rows: ImportPreviewRow[];
}

export interface ImportConfirmPayload {
  rows: Array<{
    first_name: string;
    last_name: string;
    dni: number;
    email: string;
    birth_date: string;
    domainRoleId: number;
    specialtyId: number;
  }>;
}

export interface ImportConfirmResult {
  imported: number;
  usernameCollisions: number;
}

// ── OAuth Clients ────────────────────────────────────────────────────────────

export interface ResponsibleUserResponse {
  id: string;
  username: string;
  fullName: string;
  censoredEmail: string;
}

// Respuesta general — sin clientSecret (el hash no sirve para nada en el front)
export interface OAuthClientResponse {
  id: number;
  clientName: string;
  redirectUris: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  responsibleUser: ResponsibleUserResponse | null;
}

// Respuesta de create y regenerate-secret — incluye el plainSecret una sola vez
export interface OAuthClientCreatedResponse {
  id: number;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
  updatedAt: string;
  responsibleUser: ResponsibleUserResponse | null;
}

export interface CreateOAuthClientPayload {
  clientName: string;
  redirectUris: string[];
  responsibleUserId: string;
}

export interface UpdateOAuthClientPayload {
  clientName?: string;
  redirectUris?: string[];
  responsibleUserId?: string;
}

export interface ChangeResponsibleUserPayload {
  responsibleUserId: string;
}
import { useState } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import { useNavigate } from 'react-router-dom';
import {
  Box, Title, Text, TextInput, PasswordInput,
  Button, Alert, Tabs, Paper, SegmentedControl,
} from '@mantine/core';
import {
  IconAlertCircle, IconCheck, IconShieldOff, IconTrash, IconUser, IconKey,
} from '@tabler/icons-react';
import { adminsApi } from '@/api/adminApi';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { DeleteSelfPayload } from '@/types/api.types';

type EditMode = 'username' | 'password';

export function MyProfilePage() {
  const { adminUsername, setAdminUsername } = useAuthStore();
  const { reset2fa, logout } = useAuth();
  const navigate = useNavigate();

  const [editMode, setEditMode] = useState<EditMode>('username');

  // Estados: cambiar nombre de usuario
  const [username, setUsername] = useState(adminUsername ?? '');
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState('');

  // Estados: cambiar contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback compartido de "Mis Datos"
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Estados: 2FA
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Estados: Eliminar cuenta
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleModeChange = (value: string) => {
    setEditMode(value as EditMode);
    setProfileError(null);
    setProfileSuccess(null);
    setUsername(adminUsername ?? '');
    setUsernameCurrentPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const trimmed = username.trim();
    if (trimmed === adminUsername) {
      setProfileError('El nuevo nombre de usuario es igual al actual.');
      return;
    }

    setProfileLoading(true);
    try {
      const updated = await adminsApi.updateSelf({
        username: trimmed,
        currentPassword: usernameCurrentPassword,
      });
      setAdminUsername(updated.username);
      setUsername(updated.username);
      setUsernameCurrentPassword('');
      setProfileSuccess('Nombre de usuario actualizado correctamente.');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Error al actualizar el usuario.'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (newPassword !== confirmPassword) {
      setProfileError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (newPassword === currentPassword) {
      setProfileError('La nueva contraseña debe ser distinta a la actual.');
      return;
    }

    setProfileLoading(true);
    try {
      await adminsApi.updateSelf({
        password: newPassword,
        currentPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileSuccess('Contraseña actualizada correctamente.');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Error al actualizar la contraseña.'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const payload: DeleteSelfPayload = {
        password: deletePassword,
        confirmationPhrase: deletePhrase,
      };
      await adminsApi.removeSelf(payload);
      try { await logout(); } catch { /* ignorado intencionalmente */ }
      navigate('/login');
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Error al eliminar la cuenta.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReset2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(false);
    setResetLoading(true);
    try {
      await reset2fa(resetPassword);
      setResetSuccess(true);
      setResetPassword('');
    } catch (err) {
      setResetError(getErrorMessage(err, 'Error al resetear el 2FA.'));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Box maw={480}>
      <Title order={2} mb={4}>Mi perfil</Title>
      <Text c="dimmed" size="sm" mb="xl">
        Hola, <strong>{adminUsername}</strong>. Desde acá podés actualizar tus datos y gestionar tu autenticador.
      </Text>

      <Tabs defaultValue="perfil" variant="outline" radius="md">
        <Tabs.List mb="lg">
          <Tabs.Tab value="perfil" leftSection={<IconUser size={14} />}>
            Mis Datos
          </Tabs.Tab>
          <Tabs.Tab value="2fa" leftSection={<IconShieldOff size={14} />}>
            2FA
          </Tabs.Tab>
          <Tabs.Tab value="eliminar" leftSection={<IconTrash size={14} />} color="red">
            Eliminar cuenta
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Tab: Datos personales ── */}
        <Tabs.Panel value="perfil">
          <Paper withBorder radius="md" p="lg">
            <SegmentedControl
              fullWidth
              mb="lg"
              value={editMode}
              onChange={handleModeChange}
              styles={{
                label: {
                  whiteSpace: 'normal',
                  lineHeight: 1.2,
                  paddingBlock: 6,
                },
              }}
              data={[
                {
                  value: 'username',
                  label: (
                    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <IconUser size={14} style={{ flexShrink: 0 }} />
                      <Box component="span" hiddenFrom="xs">Usuario</Box>
                      <Box component="span" visibleFrom="xs">Nombre de usuario</Box>
                    </Box>
                  ),
                },
                {
                  value: 'password',
                  label: (
                    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <IconKey size={14} style={{ flexShrink: 0 }} />
                      <span>Contraseña</span>
                    </Box>
                  ),
                },
              ]}
            />

            {profileError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">
                {profileError}
              </Alert>
            )}
            {profileSuccess && (
              <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">
                {profileSuccess}
              </Alert>
            )}

            {editMode === 'username' ? (
              <form onSubmit={(e) => void handleUsernameSubmit(e)}>
                <TextInput
                  label="Nuevo nombre de usuario"
                  description="Letras, números, puntos, guiones bajos y medios (3–32 caracteres)."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  mb="sm"
                  required
                  minLength={3}
                  maxLength={32}
                />
                <PasswordInput
                  label="Contraseña actual"
                  description="Necesaria para confirmar el cambio."
                  placeholder="••••••••"
                  value={usernameCurrentPassword}
                  onChange={(e) => setUsernameCurrentPassword(e.target.value)}
                  mb="lg"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <Button
                  type="submit"
                  fullWidth
                  loading={profileLoading}
                >
                  Actualizar nombre de usuario
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void handlePasswordSubmit(e)}>
                <PasswordInput
                  label="Contraseña actual"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  mb="sm"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <PasswordInput
                  label="Nueva contraseña"
                  description="Mínimo 8 caracteres."
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  mb="sm"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <PasswordInput
                  label="Confirmar nueva contraseña"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  mb="lg"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <Button
                  type="submit"
                  fullWidth
                  loading={profileLoading}
                >
                  Actualizar contraseña
                </Button>
              </form>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ── Tab: Reset 2FA ── */}
        <Tabs.Panel value="2fa">
          <Paper withBorder radius="md" p="lg">
            <Text size="sm" c="dimmed" mb="lg">
              Si tu secret TOTP se vio comprometido, reseteá el autenticador. El próximo login te pedirá vincular uno nuevo con un QR fresco.
            </Text>

            {resetError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">
                {resetError}
              </Alert>
            )}
            {resetSuccess && (
              <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">
                Autenticador reseteado. El próximo login te pedirá configurarlo de nuevo.
              </Alert>
            )}

            <form onSubmit={(e) => void handleReset2fa(e)}>
              <PasswordInput
                label="Confirmá tu contraseña actual"
                description="Necesaria para confirmar tu identidad."
                placeholder="••••••••"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                mb="lg"
                required
                minLength={8}
                maxLength={128}
              />
              <Button
                type="submit"
                fullWidth
                loading={resetLoading}
                color="red"
                variant="light"
                leftSection={<IconShieldOff size={16} />}
              >
                Resetear autenticador 2FA
              </Button>
            </form>
          </Paper>
        </Tabs.Panel>

        {/* ── Tab: Eliminar cuenta ── */}
        <Tabs.Panel value="eliminar">
          <Paper withBorder radius="md" p="lg">
            <Text size="sm" c="dimmed" mb="lg">
              Esta acción es <strong>irreversible</strong>. Tu cuenta será eliminada permanentemente.
              No está permitido si sos el único administrador del sistema.
            </Text>

            {deleteError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">
                {deleteError}
              </Alert>
            )}

            <form onSubmit={(e) => void handleDeleteSelf(e)}>
              <TextInput
                label="Frase de confirmación"
                description='Escribí exactamente: borrar-mi-cuenta-no-es-reversible'
                placeholder="borrar-mi-cuenta-no-es-reversible"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                mb="sm"
                required
              />
              <PasswordInput
                label="Contraseña actual"
                placeholder="••••••••"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                mb="lg"
                required
                minLength={8}
                maxLength={128}
              />
              <Button
                type="submit"
                fullWidth
                loading={deleteLoading}
                color="red"
                leftSection={<IconTrash size={16} />}
              >
                Eliminar mi cuenta
              </Button>
            </form>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
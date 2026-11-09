import { useState } from 'react';
import {
  Box, Title, Text, TextInput, PasswordInput,
  Button, Alert, Tabs, Paper,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconShieldOff, IconUser } from '@tabler/icons-react';
import { adminsApi } from '@/api/adminApi';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { UpdateAdminPayload } from '@/types/api.types';

export function MyProfilePage() {
  const { adminUsername, setTokens, accessToken, refreshToken } = useAuthStore();
  const { reset2fa } = useAuth();

  const [username, setUsername] = useState(adminUsername ?? '');
  const [password, setPassword] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);
    try {
      const payload: UpdateAdminPayload = {};
      if (username !== adminUsername) payload.username = username;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 0) {
        setProfileError('No hay cambios para guardar.');
        return;
      }
      await adminsApi.updateSelf(payload);
      setProfileSuccess(true);
      setPassword('');
      if (accessToken && refreshToken) setTokens(accessToken, refreshToken);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setProfileError(axiosError?.response?.data?.message ?? 'Error al guardar.');
    } finally {
      setProfileLoading(false);
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
      const axiosError = err as { response?: { data?: { message?: string } } };
      setResetError(axiosError?.response?.data?.message ?? 'Error al resetear el 2FA.');
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
            Datos personales
          </Tabs.Tab>
          <Tabs.Tab value="2fa" leftSection={<IconShieldOff size={14} />}>
            Autenticador 2FA
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Tab: Datos personales ── */}
        <Tabs.Panel value="perfil">
          <Paper withBorder radius="md" p="lg">
            {profileError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">
                {profileError}
              </Alert>
            )}
            {profileSuccess && (
              <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">
                Cambios guardados correctamente.
              </Alert>
            )}
            <form onSubmit={(e) => void handleProfileSubmit(e)}>
              <TextInput
                label="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                mb="sm"
                required
                minLength={3}
              />
              <PasswordInput
                label="Nueva contraseña"
                description="Dejá vacío si no querés cambiarla."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                mb="lg"
                minLength={8}
              />
              <Button
                type="submit"
                fullWidth
                loading={profileLoading}
                style={{ background: '#f5a705', color: '#1a1200' }}
              >
                Guardar cambios
              </Button>
            </form>
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
      </Tabs>
    </Box>
  );
}
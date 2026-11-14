import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Title, Text, PasswordInput, Button, Alert, Paper, Center, Loader,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { apiClient } from '@/api/client';

function formatTokenError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string | string[] } } };
  const msg = ax?.response?.data?.message;
  const errorText = Array.isArray(msg) ? msg.join(' ') : (msg ?? '');

  if (errorText.toLowerCase().includes('suspendida')) {
    return 'No podés registrar una contraseña: la cuenta está suspendida. Contactá a un administrador.';
  }
  if (errorText.toLowerCase().includes('no encontrado')) {
    return 'Tu cuenta ya no está registrada. Hablá con un administrador.';
  }
  return errorText || 'El link no es válido o ya fue utilizado.';
}

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [validating, setValidating] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let ignore = false;

    const checkToken = async () => {
      setValidating(true);
      try {
        await apiClient.post('/sso/validate-reset-token', { token });
      } catch (err) {
        if (!ignore) setFatalError(formatTokenError(err));
      } finally {
        if (!ignore) setValidating(false);
      }
    };

    void checkToken();
    return () => { ignore = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setFormError('Las contraseñas no coinciden.'); return; }
    if (password.length < 8) { setFormError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setFormError(null); setLoading(true);
    try {
      await apiClient.post('/sso/set-password', { token, password, confirmPassword: confirm });
      setSuccess(true);
    } catch (err) {
      setFatalError(formatTokenError(err));
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <Center h="100vh">
        <Alert icon={<IconAlertCircle size={16} />} color="red" maw={400}>
          El link no es válido. Verificá que lo hayas copiado correctamente.
        </Alert>
      </Center>
    );
  }

  return (
    <Center h="100vh" bg="var(--mantine-color-body)">
      <Box w={360} px="md">
        <Title order={2} mb={4} ta="center">Configurar contraseña</Title>
        <Paper withBorder radius="md" p="lg">
          {validating ? (
            <Center py="xl">
              <Loader color="orange" size="sm" />
            </Center>
          ) : success ? (
            <Alert icon={<IconCheck size={16} />} color="green" radius="md">
              ¡Contraseña establecida! Ya podés cerrar esta página.
            </Alert>
          ) : fatalError ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
              {fatalError}
            </Alert>
          ) : (
            <>
              {formError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">
                  {formError}
                </Alert>
              )}

              <Text c="dimmed" size="sm" ta="center" mb="xl">
                Elegí una contraseña de al menos 8 caracteres para tu cuenta.
              </Text>
              <form onSubmit={e => void handleSubmit(e)}>
                <PasswordInput
                  label="Nueva contraseña"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  mb="sm"
                  required
                  minLength={8}
                />
                <PasswordInput
                  label="Confirmar contraseña"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  mb="lg"
                  required
                  minLength={8}
                />
                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  style={{ background: '#f5a705', color: '#1a1200' }}
                >
                  Guardar contraseña
                </Button>
              </form>
            </>
          )}
        </Paper>
      </Box>
    </Center>
  );
}
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Title, Text, PasswordInput, Button, Alert, Paper, Center,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { apiClient } from '@/api/client';

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setError(null); setLoading(true);
    try {
      await apiClient.post('/sso/set-password', { token, password, confirmPassword: confirm });
      setSuccess(true);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string | string[] } } };
      const msg = ax?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'El link no es válido o ya fue utilizado.'));
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
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Elegí una contraseña de al menos 8 caracteres para tu cuenta.
        </Text>
        <Paper withBorder radius="md" p="lg">
          {success ? (
            <>
              <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">
                ¡Contraseña configurada correctamente! Ya podés iniciar sesión.
              </Alert>
              <Button fullWidth variant="outline" onClick={() => navigate('/login')}>
                Ir al panel
              </Button>
            </>
          ) : (
            <>
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">
                  {error}
                </Alert>
              )}
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
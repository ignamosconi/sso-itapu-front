import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Text, PasswordInput, Button, Alert, Center, Loader } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { apiClient } from '@/api/client';
import { UserPageLayout } from '@/components/layout/UserPageLayout';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');

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
        navigate({ search: '' }, { replace: true });
      } catch (err) {
        if (!ignore) setFatalError(formatTokenError(err));
      } finally {
        if (!ignore) setValidating(false);
      }
    };

    void checkToken();
    return () => { ignore = true; };
  }, [token, navigate]);

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
      <UserPageLayout title="Configurar contraseña">
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
          El link no es válido. Verificá que lo hayas copiado correctamente.
        </Alert>
      </UserPageLayout>
    );
  }

  return (
    <UserPageLayout title="Configurar contraseña">
      {validating ? (
        <Center py="xl">
          <Loader size="sm" />
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
            <Button type="submit" fullWidth loading={loading}>
              Guardar contraseña
            </Button>
          </form>
        </>
      )}
    </UserPageLayout>
  );
}

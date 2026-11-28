import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Text, PasswordInput, Button, Alert, Center, Loader } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { apiClient } from '@/api/client';
import { UserPageLayout } from '@/components/layout/UserPageLayout';
import { getErrorMessage, isNetworkError } from '@/utils/apiError';
import { passwordPolicyError } from '@/utils/passwordPolicy';
import { PasswordRequirements } from '@/components/ui/PasswordRequirements';

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

// Errores que se pueden reintentar con el mismo link: no hay conexión, demasiados pedidos seguidos o un
// fallo del servidor. Con `includeValidation` también cuenta como reintentable un 400 (contraseña que el
// servidor no acepta). El resto (404 link inexistente, 410 usado o vencido, 401 cuenta suspendida) significa
// que el link ya no sirve. Si el error no trae código de estado se lo trata como fatal, como antes.
function isRetryable(err: unknown, includeValidation: boolean): boolean {
  if (isNetworkError(err)) return true;
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return false;
  return status === 429 || status >= 500 || (includeValidation && status === 400);
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
        if (!ignore) {
          // El token sigue en la URL (solo se saca al validar bien): recargar la página alcanza para reintentar.
          setFatalError(
            isRetryable(err, false)
              ? `${getErrorMessage(err, 'No se pudo verificar el link.')} Recargá la página para volver a intentarlo.`
              : formatTokenError(err),
          );
        }
      } finally {
        if (!ignore) setValidating(false);
      }
    };

    void checkToken();
    return () => { ignore = true; };
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Primero la política (dice de una todo lo que falta) y después la coincidencia.
    const policyError = passwordPolicyError(password);
    if (policyError) { setFormError(policyError); return; }
    if (password !== confirm) { setFormError('Las contraseñas no coinciden.'); return; }
    setFormError(null); setLoading(true);
    try {
      await apiClient.post('/sso/set-password', { token, password, confirmPassword: confirm });
      setSuccess(true);
    } catch (err) {
      // Si el problema es la contraseña, la conexión o un límite de pedidos, se queda el formulario con el aviso:
      // el token ya no está en la URL, así que perder el formulario obligaría a pedir otro mail.
      if (isRetryable(err, true)) {
        setFormError(getErrorMessage(err, 'No se pudo guardar la contraseña. Intentá de nuevo en unos minutos.'));
      } else {
        setFatalError(formatTokenError(err));
      }
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
            Elegí una contraseña segura para tu cuenta.
          </Text>
          <form onSubmit={e => void handleSubmit(e)}>
            <PasswordInput
              label="Nueva contraseña"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              mb="xs"
              required
              maxLength={128}
              autoComplete="new-password"
            />
            <PasswordRequirements password={password} />
            <PasswordInput
              label="Confirmar contraseña"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              mb="lg"
              required
              maxLength={128}
              autoComplete="new-password"
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

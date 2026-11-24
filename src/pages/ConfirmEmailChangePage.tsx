import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Text, Button, Alert } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { apiClient } from '@/api/client';
import { UserPageLayout } from '@/components/layout/UserPageLayout';

interface ConfirmError {
  message: string;
  // Si el link no sirve más (inválido, vencido, usado, cuenta inactiva) no tiene sentido reintentar.
  fatal: boolean;
}

function formatConfirmError(err: unknown): ConfirmError {
  const ax = err as { response?: { status?: number; data?: { message?: string | string[] } } };
  const status = ax?.response?.status;
  const msg = ax?.response?.data?.message;
  const text = Array.isArray(msg) ? msg.join(' ') : (msg ?? '');

  if (status === 429) {
    return { message: 'Hiciste demasiados intentos seguidos. Esperá un minuto y volvé a intentar.', fatal: false };
  }
  if (status === 404) {
    return { message: text || 'El link no es válido o la cuenta ya no existe.', fatal: true };
  }
  if (status === 400 || status === 409 || status === 410) {
    return { message: text || 'No se pudo confirmar el cambio de email.', fatal: true };
  }
  return { message: 'No se pudo confirmar el cambio. Intentá de nuevo en unos minutos.', fatal: false };
}

export function ConfirmEmailChangePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ConfirmError | null>(null);

  // Saca el token de la URL (historial, capturas de pantalla, cabecera Referer).
  // Queda guardado en el estado para poder confirmar.
  useEffect(() => {
    if (token) navigate({ search: '' }, { replace: true });
  }, [token, navigate]);

  // El cambio se confirma con un clic y no al abrir la página: así un antivirus o un
  // previsualizador de links que abra el mail no lo confirma sin que el alumno lo sepa.
  const handleConfirm = async () => {
    if (loading || done) return;
    setLoading(true); setError(null);
    try {
      await apiClient.post('/sso/confirm-email-change', { token });
      setDone(true);
    } catch (err) {
      setError(formatConfirmError(err));
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <UserPageLayout title="Confirmar nuevo email">
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
          El link no es válido. Verificá que lo hayas copiado correctamente.
        </Alert>
      </UserPageLayout>
    );
  }

  return (
    <UserPageLayout title="Confirmar nuevo email">
      {done ? (
        <Alert icon={<IconCheck size={16} />} color="green" radius="md">
          ¡Listo! Tu email fue actualizado. Por seguridad cerramos todas tus sesiones: la próxima vez que
          entres a una aplicación vas a tener que iniciar sesión de nuevo. Ya podés cerrar esta página.
        </Alert>
      ) : error?.fatal ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" role="alert">
          {error.message}
        </Alert>
      ) : (
        <>
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md" role="alert">
              {error.message}
            </Alert>
          )}
          <Text c="dimmed" size="sm" ta="center" mb="xl">
            Confirmá que querés usar este email para tu cuenta de ITAPU. Se cerrarán todas tus sesiones activas.
          </Text>
          <Button fullWidth loading={loading} onClick={() => void handleConfirm()}>
            Confirmar cambio de email
          </Button>
        </>
      )}
    </UserPageLayout>
  );
}

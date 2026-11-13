import { useEffect, useState } from 'react';
import {
  Box, Title, Text, Card, Group, ThemeIcon, Badge,
  ActionIcon, Tooltip, SimpleGrid,
} from '@mantine/core';
import { IconShieldCheck, IconShieldX, IconRefresh } from '@tabler/icons-react';
import { healthApi } from '@/api/healthApi';

type Status = 'checking' | 'up' | 'down';

interface StatusCardProps {
  label: string;
  description: string;
  status: Status;
  checkedAt: string | null;
  onRetry: () => void;
}

function StatusCard({ label, description, status, checkedAt, onRetry }: StatusCardProps) {
  const isUp = status === 'up';
  const isChecking = status === 'checking';
  const color = isChecking ? 'gray' : isUp ? 'green' : 'red';

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="sm">
        <Group>
          <ThemeIcon variant="light" color={color} size="lg" radius="md">
            {isUp ? <IconShieldCheck size={18} /> : <IconShieldX size={18} />}
          </ThemeIcon>
          <Box>
            <Text fw={600} size="sm">{label}</Text>
            <Text size="xs" c="dimmed">{description}</Text>
          </Box>
        </Group>
        <Tooltip label="Verificar ahora">
          <ActionIcon variant="subtle" onClick={onRetry} loading={isChecking}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Badge color={color} variant="light" size="lg">
        {isChecking ? 'Verificando...' : isUp ? 'En línea' : 'Sin conexión'}
      </Badge>

      {checkedAt && (
        <Text size="xs" c="dimmed" mt="sm">
          Último chequeo: {checkedAt} · Se actualiza cada 30 segundos
        </Text>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const [ssoStatus, setSsoStatus] = useState<Status>('checking');
  const [ssoCheckedAt, setSsoCheckedAt] = useState<string | null>(null);

  const checkSso = async () => {
    setSsoStatus('checking');
    const ok = await healthApi.checkSso();
    setSsoStatus(ok ? 'up' : 'down');
    setSsoCheckedAt(
      new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit', // sacá esta línea si no querés los segundos
        hour12: false,
      })
    );
  };


  const checkAll = () => {
    checkSso();
  };

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      <Title order={2} mb={4}>Dashboard</Title>
      <Text c="dimmed" mb="xl">Bienvenido al panel de administración del SSO FRVM.</Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" maw={800}>
        <StatusCard
          label="Backend - SSO ITAPU"
          description="Servidor de autenticación"
          status={ssoStatus}
          checkedAt={ssoCheckedAt}
          onRetry={checkSso}
        />
      </SimpleGrid>
    </Box>
  );
}
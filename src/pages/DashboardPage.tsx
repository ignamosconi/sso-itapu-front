import { useEffect, useState, useRef } from 'react';
import {
  Box, Title, Text, Card, Group, ThemeIcon, Badge,
  ActionIcon, Tooltip, SimpleGrid, Loader, Center,
} from '@mantine/core';
import {
  IconShieldCheck, IconShieldX, IconRefresh,
  IconApps, IconUsers, IconChartBar,
} from '@tabler/icons-react';
import { healthApi } from '@/api/healthApi';
import { statsApi, DashboardStats } from '@/api/statsApi';

// ── Health card ───────────────────────────────────────────────────────────────

type Status = 'checking' | 'up' | 'down';

interface StatusCardProps {
  label: string;
  description: string;
  status: Status;
  checkedAt: string | null;
}

function StatusCard({ label, description, status, checkedAt }: StatusCardProps) {
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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group>
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          <Icon size={18} />
        </ThemeIcon>
        <Box>
          <Text size="xs" c="dimmed">{label}</Text>
          {value === null
            ? <Loader size="xs" color={color} mt={4} />
            : <Text fw={700} size="xl">{value}</Text>}
        </Box>
      </Group>
    </Card>
  );
}

// ── Bar chart inline ──────────────────────────────────────────────────────────

function SpecialtyChart({ data }: { data: { specialty: string; count: number }[] }) {

  const BAR_COLORS = [
    '#f5a705', '#4c6ef5', '#12b886', '#e64980',
    '#7950f2', '#fd7e14', '#15aabf', '#94d82d',
    '#f03e3e', '#1098ad',
  ];

  const max = Math.max(...data.map(d => d.count), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <Card withBorder radius="md" p="lg">
        <Group mb="md">
          <ThemeIcon variant="light" color="violet" size="lg" radius="md">
            <IconChartBar size={18} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="sm">Alumnos por especialidad</Text>
            <Text size="xs" c="dimmed">Cuentas activas y pendientes</Text>
          </Box>
        </Group>
        <Text size="sm" c="dimmed">No hay datos disponibles.</Text>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="lg">
      <Group mb="md">
        <ThemeIcon variant="light" color="violet" size="lg" radius="md">
          <IconChartBar size={18} />
        </ThemeIcon>
        <Box>
          <Text fw={600} size="sm">Alumnos por especialidad</Text>
          <Text size="xs" c="dimmed">Cuentas activas y pendientes</Text>
        </Box>
      </Group>

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((d, i) => (
          <Box key={d.specialty}>
            <Group justify="space-between" mb={4}>
              <Text size="xs" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                {d.specialty}
              </Text>
              <Text size="xs" fw={600} c={hovered === i ? BAR_COLORS[i % BAR_COLORS.length] : 'dimmed'}>
                {d.count}
              </Text>
            </Group>
            <Box
              style={{ background: 'var(--mantine-color-default-border)', borderRadius: 4, height: 12, overflow: 'hidden', cursor: 'default' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <Box
                style={{
                  width: `${(d.count / max) * 100}%`,
                  height: '100%',
                  background: BAR_COLORS[i % BAR_COLORS.length],
                  opacity: hovered === i ? 1 : 0.75,
                  borderRadius: 4,
                  transition: 'background 150ms ease, width 400ms ease',
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const REFRESH_COOLDOWN_MS = 30_000; // mínimo entre refreshes manuales

export function DashboardPage() {
  const [ssoStatus, setSsoStatus] = useState<Status>('checking');
  const [ssoCheckedAt, setSsoCheckedAt] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const lastRefresh = useRef<number>(0);
  const [refreshCooldown, setRefreshCooldown] = useState(false);

  const checkSso = async () => {
    setSsoStatus('checking');
    const ok = await healthApi.checkSso();
    setSsoStatus(ok ? 'up' : 'down');
    setSsoCheckedAt(
      new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    );
  };

  const loadStats = async (force = false) => {
    if (force) {
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_COOLDOWN_MS) return;
      lastRefresh.current = now;
      setRefreshCooldown(true);
      setTimeout(() => setRefreshCooldown(false), REFRESH_COOLDOWN_MS);
    }
    setStatsLoading(true);
    try {
      setStats(await statsApi.getDashboard(force));
    } catch { /* silencioso */ }
    finally { setStatsLoading(false); }
  };

  useEffect(() => {
    void checkSso();
    void loadStats();

    const healthInterval = setInterval(() => { void checkSso(); }, 30_000);
    // Stats se refrescan desde caché (15 min TTL) — no hace falta interval
    return () => clearInterval(healthInterval);
  }, []);

  return (
    <Box>
      <Group justify="space-between" mb={4} align="flex-end">
        <Box>
          <Title order={2} mb={4}>Dashboard</Title>
          <Text c="dimmed" mb="xl">Bienvenido al panel de administración del SSO ITAPU.</Text>
        </Box>
        <Tooltip label={refreshCooldown ? 'Podés actualizar cada 30s' : 'Actualizar estadísticas'}>
          <ActionIcon
            variant="subtle"
            loading={statsLoading}
            disabled={refreshCooldown}
            color={refreshCooldown ? 'gray' : undefined}
            onClick={() => { void loadStats(true); }}
            mb="xl"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Contadores */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md" maw={800}>
        <StatCard
          icon={IconApps}
          label="Apps integradas (activas)"
          value={stats?.oauthClientCount ?? null}
          color="blue"
        />
        <StatCard
          icon={IconUsers}
          label="Usuarios registrados (total)"
          value={stats?.studentCount ?? null}
          color="teal"
        />
      </SimpleGrid>

      {/* Gráfico */}
      <Box maw={800} mb="md">
        {stats
          ? <SpecialtyChart data={stats.studentsBySpecialty} />
          : (
            <Card withBorder radius="md" p="lg">
              <Center h={80}><Loader size="sm" /></Center>
            </Card>
          )
        }
      </Box>

      {/* Health */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" maw={800}>
        <StatusCard
          label="Backend — SSO ITAPU"
          description="Servidor de autenticación"
          status={ssoStatus}
          checkedAt={ssoCheckedAt}
        />
      </SimpleGrid>
    </Box>
  );
}
import { useEffect, type ReactNode } from 'react';
import {
  Box, Group, Image, Paper, Text, Title,
  useComputedColorScheme, useMantineColorScheme,
} from '@mantine/core';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import logoItapu from '@/assets/logo-itapu.png';

const SERIF = "Georgia, 'Times New Roman', serif";
const COLOR_SCHEME_KEY = 'mantine-color-scheme-value';

interface UserPageLayoutProps {
  title: string;
  children: ReactNode;
  width?: number;
}

/**
 * Marco común de las páginas que abren los usuarios desde un mail
 * (configurar contraseña, confirmar email). Mismo fondo, tarjeta, logo,
 * tipografía y toggle de tema en todas.
 */
export function UserPageLayout({ title, children, width = 400 }: UserPageLayoutProps) {
  const { setColorScheme } = useMantineColorScheme();
  const isLight = useComputedColorScheme('light') === 'light';

  // Los mails son claros: si la persona nunca eligió un tema, arranca en claro.
  useEffect(() => {
    try {
      if (localStorage.getItem(COLOR_SCHEME_KEY) === null) setColorScheme('light');
    } catch { /* storage no disponible */ }
  }, [setColorScheme]);

  return (
    <Box
      mih="100vh"
      p="md"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
    >
      <Box style={{ position: 'absolute', top: 12, right: 12 }}>
        <ThemeToggle />
      </Box>

      <Box w="100%" maw={width}>
        <Group justify="center" gap="xs" mb="md" wrap="nowrap">
          <Image src={logoItapu} w={32} h={32} fit="contain" />
          <Text fw={700} size="sm" lh={1.2}>
            <Text span inherit c={isLight ? '#E5322D' : '#F4A09A'}>Single Sign On</Text>
          </Text>
        </Group>

        <Paper
          radius="lg"
          p="xl"
          style={{
            border: isLight ? '1px solid #171516' : '1px solid var(--mantine-color-dark-4)',
          }}
        >
          <Title order={2} ta="center" mb="md" ff={SERIF}>{title}</Title>
          {children}
        </Paper>

      </Box>
    </Box>
  );
}

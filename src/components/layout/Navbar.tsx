import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Stack, Text, UnstyledButton, Group, Box, Divider, Image, Loader, Tooltip,
} from '@mantine/core';
import {
  IconUser, IconUsers, IconLogout, IconDashboard, IconQuestionMark,
  IconSchool, IconApps, IconChevronDown,
} from '@tabler/icons-react';
import { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import logoUtn from '@/assets/logo-utn.png';

const NAVBAR_EXPANDED = 220;
const NAVBAR_COLLAPSED = 60;

// ── DragHandle (Manija para arrastrar o hacer click) ──────────────────────────

interface DragHandleProps {
  isOpen: boolean;
  onToggle: () => void;
}

function DragHandle({ isOpen, onToggle }: DragHandleProps) {
  const startX = useRef(0);
  const didDrag = useRef(false);
  const [hovered, setHovered] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    didDrag.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (Math.abs(e.clientX - startX.current) > 8) didDrag.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const delta = e.clientX - startX.current;
    if (!didDrag.current || Math.abs(delta) < 8) {
      onToggle();
    } else if (delta > 30 && !isOpen) {
      onToggle();
    } else if (delta < -30 && isOpen) {
      onToggle();
    }
  };

  return (
    <Box
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 14,
        height: '100%',
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        zIndex: 10,
      }}
    >
      <Box
        style={{
          width: 3,
          height: 36,
          borderRadius: 2,
          background: hovered
            ? 'var(--mantine-color-orange-4)'
            : 'var(--mantine-color-default-border)',
          transition: 'background 150ms ease',
        }}
      />
    </Box>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ElementType;
  isOpen: boolean;
  onSelect?: () => void;
}

function NavItem({ to, label, icon: Icon, isOpen, onSelect }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  if (!isOpen) {
    return (
      <Tooltip label={label} position="right" withArrow>
        <NavLink to={to} onClick={onSelect} style={{ textDecoration: 'none', display: 'block' }}>
          <UnstyledButton
            w={40}
            h={36}
            mx="auto"
            style={(theme) => ({
              borderRadius: theme.radius.sm,
              background: isActive ? 'var(--mantine-color-orange-light)' : 'transparent',
              color: isActive ? '#f5a705' : 'var(--mantine-color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icon size={18} />
          </UnstyledButton>
        </NavLink>
      </Tooltip>
    );
  }

  return (
    <NavLink to={to} onClick={onSelect} style={{ textDecoration: 'none', display: 'block' }}>
      <UnstyledButton
        w="100%"
        px="sm"
        py={7}
        style={(theme) => ({
          borderRadius: theme.radius.sm,
          background: isActive ? 'var(--mantine-color-orange-light)' : 'transparent',
          color: isActive ? '#f5a705' : 'var(--mantine-color-text)',
        })}
      >
        <Group gap="sm" justify="flex-start" align="center" wrap="nowrap">
          <Icon size={18} style={{ flexShrink: 0 }} />
          <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{label}</Text>
        </Group>
      </UnstyledButton>
    </NavLink>
  );
}

// ── NavSubMenu (Desplegable) ──────────────────────────────────────────────────

interface NavSubItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavSubMenuProps {
  label: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggleNavbar: () => void;
  onSelect?: () => void;
  items: NavSubItem[];
}

function NavSubMenu({ label, icon: Icon, isOpen, onToggleNavbar, onSelect, items }: NavSubMenuProps) {
  const location = useLocation();
  const isAnyChildActive = items.some(item => location.pathname === item.to);
  const [opened, setOpened] = useState(isAnyChildActive);

  useEffect(() => {
    if (isAnyChildActive) setOpened(true);
  }, [location.pathname, isAnyChildActive]);

  const handleParentClick = () => {
    if (!isOpen) {
      onToggleNavbar();
      setOpened(true);
    } else {
      setOpened(o => !o);
    }
  };

  if (!isOpen) {
    return (
      <Tooltip label={label} position="right" withArrow>
        <UnstyledButton
          w={40} h={36} mx="auto"
          onClick={handleParentClick}
          style={(theme) => ({
            borderRadius: theme.radius.sm,
            background: isAnyChildActive ? 'var(--mantine-color-orange-light)' : 'transparent',
            color: isAnyChildActive ? '#f5a705' : 'var(--mantine-color-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          })}
        >
          <Icon size={18} />
        </UnstyledButton>
      </Tooltip>
    );
  }

  return (
    <Box>
      <UnstyledButton
        w="100%" px="sm" py={7}
        onClick={handleParentClick}
        style={(theme) => ({
          borderRadius: theme.radius.sm,
          background: isAnyChildActive && !opened ? 'var(--mantine-color-orange-light)' : 'transparent',
          color: isAnyChildActive ? '#f5a705' : 'var(--mantine-color-text)',
        })}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" align="center" wrap="nowrap">
            <Icon size={18} style={{ flexShrink: 0 }} />
            <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{label}</Text>
          </Group>
          <IconChevronDown
            size={14}
            style={{
              transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
              flexShrink: 0,
            }}
          />
        </Group>
      </UnstyledButton>
      <Box style={{ display: opened ? 'block' : 'none' }}>
        <Stack gap={2} mt={2} pl="md">
          {items.map(item => (
            <NavItem key={item.to} {...item} isOpen={true} onSelect={onSelect} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}


// ── Navbar Principal ──────────────────────────────────────────────────────────

interface NavbarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isMobile: boolean;
}

export function Navbar({ isOpen, onToggle, onClose, isMobile }: NavbarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleSelect = () => {
    if (isMobile) onClose();
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } finally {
      setLogoutLoading(false);
      if (isMobile) onClose();
      navigate('/login');
    }
  };

  const visualWidth = isOpen ? NAVBAR_EXPANDED : NAVBAR_COLLAPSED;

  return (
    <>
      {/* Backdrop: se activa solo en mobile cuando el menú está abierto */}
      {isMobile && isOpen && (
        <Box
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 99,
          }}
        />
      )}

      {/* Contenedor visual del Navbar */}
      <Box
        style={{
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? 0 : undefined,
          left: isMobile ? 0 : undefined,
          height: isMobile ? '100dvh' : '100%',
          width: visualWidth,
          transition: 'width 200ms ease',
          overflow: 'visible',
          zIndex: isMobile ? 100 : undefined,
          background: 'var(--mantine-color-body)',
          borderRight: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <DragHandle isOpen={isOpen} onToggle={onToggle} />

        <Stack h="100%" justify="space-between" p={isOpen ? 'md' : 'xs'} style={{ overflow: 'hidden' }}>
          <Box
            style={{
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Logo y título */}
            <NavLink to="/dashboard" onClick={handleSelect} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group mb="xl" gap="xs" justify={isOpen ? 'flex-start' : 'center'} wrap="nowrap" style={{ cursor: 'pointer' }}>
                <Image src={logoUtn} w={32} h={32} fit="contain" style={{ flexShrink: 0 }} />
                {isOpen && (
                  <Box style={{ overflow: 'hidden' }}>
                    <Text fw={600} size="sm" lh={1.2} style={{ whiteSpace: 'nowrap' }}>
                      SSO FRVM
                    </Text>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      Panel de administración
                    </Text>
                  </Box>
                )}
              </Group>
            </NavLink>

            {/* Links de navegación */}
            <Stack gap={4}>
              <NavItem to="/dashboard" label="Dashboard" icon={IconDashboard} isOpen={isOpen} onSelect={handleSelect} />

              <NavItem to="/clients" label="Clientes OAuth" icon={IconApps} isOpen={isOpen} onSelect={handleSelect} />

              <NavSubMenu
                label="Usuarios"
                icon={IconSchool}
                isOpen={isOpen}
                onToggleNavbar={onToggle}
                onSelect={handleSelect}
                items={[
                  { to: '/padron/cargar', label: 'Cargar usuarios', icon: IconUsers },
                  { to: '/padron', label: 'Padrón', icon: IconUsers },
                  { to: '/padron/roles', label: 'Roles inst.', icon: IconUsers },
                  { to: '/padron/especialidades', label: 'Especialidades', icon: IconUsers },
                ]}
              />

              <NavSubMenu
                label="Configuración"
                icon={IconUsers}
                isOpen={isOpen}
                onToggleNavbar={onToggle}
                onSelect={handleSelect}
                items={[
                  { to: '/admins/me', label: 'Mi perfil', icon: IconUser },
                  { to: '/admins', label: 'Administradores', icon: IconUsers },
                ]}
              />

              <NavItem to="/faqs" label="FAQs" icon={IconQuestionMark} isOpen={isOpen} onSelect={handleSelect} />
            </Stack>
          </Box>

          {/* Footer del navbar */}
          <Box>
            <Divider mb="sm" />
            {isOpen ? (
              <Group justify="space-between" wrap="nowrap">
                <UnstyledButton onClick={() => void handleLogout()} disabled={logoutLoading} style={{ overflow: 'hidden' }}>
                  <Group gap="sm" wrap="nowrap">
                    {logoutLoading
                      ? <Loader size={16} color="orange" style={{ flexShrink: 0 }} />
                      : <IconLogout size={16} style={{ flexShrink: 0 }} />}
                    <Text size="sm" c={logoutLoading ? 'dimmed' : undefined} style={{ whiteSpace: 'nowrap' }}>
                      {logoutLoading ? 'Cerrando...' : 'Cerrar sesión'}
                    </Text>
                  </Group>
                </UnstyledButton>
                <ThemeToggle />
              </Group>
            ) : (
              <Stack gap="xs" align="center">
                <Tooltip label="Cerrar sesión" position="right" withArrow>
                  <UnstyledButton onClick={() => void handleLogout()} disabled={logoutLoading}>
                    {logoutLoading
                      ? <Loader size={16} color="orange" />
                      : <IconLogout size={16} />}
                  </UnstyledButton>
                </Tooltip>
                <ThemeToggle />
              </Stack>
            )}
          </Box>
        </Stack>
      </Box>
    </>
  );
}
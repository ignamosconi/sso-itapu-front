import { AppShell as MantineAppShell, Box } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function AppShell() {
  return (
    <MantineAppShell
      navbar={{ width: 220, breakpoint: 'sm' }}
      padding="md"
    >
      <MantineAppShell.Navbar>
        <Navbar />
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Box maw={1100} mx="auto">
          <Outlet />
        </Box>
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
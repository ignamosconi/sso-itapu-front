import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';
import App from './App';
import { theme } from './theme';
import { useAuthStore } from '@/store/authStore';

// Intentar recuperar sesión antes de montar React
// ProtectedRoute usará isBootstrapping para mostrar un loader mientras tanto
void useAuthStore.getState().bootstrap().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <ModalsProvider>
          <Notifications />
          <App />
        </ModalsProvider>
      </MantineProvider>
    </StrictMode>,
  );
});

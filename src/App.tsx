import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MyProfilePage } from '@/pages/MyProfilePage';
import { AdminsPage } from '@/pages/AdminsPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { FaqsPage } from '@/pages/FaqsPage';
import { PadronPage } from '@/pages/PadronPage';
import { CargarUsuariosPage } from '@/pages/CargarUsuariosPage';
import { RolesPage } from '@/pages/RolesPage';
import { EspecialidadesPage } from '@/pages/EspecialidadesPage';
import { SetPasswordPage } from '@/pages/SetPasswordPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="admins/me" element={<MyProfilePage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="faqs" element={<FaqsPage />} />
          <Route path="padron" element={<PadronPage />} />
          <Route path="padron/cargar" element={<CargarUsuariosPage />} />
          <Route path="padron/roles" element={<RolesPage />} />
          <Route path="padron/especialidades" element={<EspecialidadesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
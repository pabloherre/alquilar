import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Alert, Box, Container } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Topbar from './components/Topbar';
import LoginPage from './pages/LoginPage';
import MagicLoginPage from './pages/MagicLoginPage';
import DashboardPage from './pages/DashboardPage';
import NewContractPage from './pages/NewContractPage';
import ContractDetailPage from './pages/ContractDetailPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardPage />;
}

function AppShell() {
  const isOnline = useOnlineStatus();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #e2f7f3 0%, #eff6ff 55%, #f8fafc 100%)',
        pb: 'env(safe-area-inset-bottom)'
      }}
    >
      <Topbar />
      {!isOnline && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Sin conexión — mostrando datos guardados.
        </Alert>
      )}
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, md: 3 } }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/magic/:token" element={<MagicLoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin/new-contract" element={<NewContractPage />} />
          </Route>
        </Routes>
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
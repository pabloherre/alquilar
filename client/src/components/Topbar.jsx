import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Box,
  Chip,
  Stack
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import HomeIcon from '@mui/icons-material/Home';
import LockResetIcon from '@mui/icons-material/LockReset';
import { useAuth } from '../context/AuthContext';

export default function Topbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (!user) return null;

  const links = [
    { to: '/', label: 'Inicio', icon: <HomeIcon fontSize="small" /> },
    { to: '/change-password', label: 'Contrasena', icon: <LockResetIcon fontSize="small" /> },
    ...(user.role === 'admin' ? [{ to: '/admin/new-contract', label: 'Nuevo', icon: <AddBusinessIcon fontSize="small" /> }] : [])
  ];

  return (
    <>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #dbe5ef' }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton edge="start" onClick={() => setOpen(true)} sx={{ display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            AlquilAR Contratos
          </Typography>

          <Chip label={user.role === 'admin' ? 'Administrador' : 'Inquilino'} color="primary" size="small" />

          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {links.map((link) => (
              <Button
                key={link.to}
                component={RouterLink}
                to={link.to}
                variant={location.pathname === link.to ? 'contained' : 'text'}
                startIcon={link.icon}
              >
                {link.label}
              </Button>
            ))}
            <Button onClick={logout} color="inherit" startIcon={<LogoutIcon />}>
              Salir
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={() => setOpen(false)}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
            <Typography variant="h6">Menú</Typography>
          </Box>
          <List>
            {links.map((link) => (
              <ListItemButton key={link.to} component={RouterLink} to={link.to} selected={location.pathname === link.to}>
                <ListItemText primary={link.label} />
              </ListItemButton>
            ))}
            <ListItemButton onClick={logout}>
              <ListItemText primary="Salir" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import HomeIcon from '@mui/icons-material/Home';
import LockIcon from '@mui/icons-material/Lock';
import LockResetIcon from '@mui/icons-material/LockReset';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 280;

export default function Topbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (!user) return null;

  const navLinks = [
    { to: '/', label: 'Inicio', icon: <HomeIcon /> },
    { to: '/change-password', label: 'Cambiar contraseña', icon: <LockIcon /> },
    ...(user.role === 'admin'
      ? [{ to: '/admin/new-contract', label: 'Nuevo contrato', icon: <AddCircleIcon /> }]
      : [])
  ];

  const userInitial = (user.name || user.email || '?')[0].toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrador' : 'Inquilino';

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid #dbe5ef', minHeight: { xs: 56, md: 64 } }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56, md: 64 } }}>
          <IconButton
            edge="start"
            onClick={() => setOpen(true)}
            sx={{ display: { md: 'none' } }}
            aria-label="Abrir menú"
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{ flexGrow: 1, textAlign: { xs: 'center', md: 'left' } }}
          >
            AlquilAR
          </Typography>

          <Chip
            label={roleLabel}
            color="primary"
            size="small"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          />

          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {navLinks.map((link) => (
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

      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: DRAWER_WIDTH } }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44, fontWeight: 700 }}>
            {userInitial}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
              {user.name || user.email}
            </Typography>
            <Chip label={roleLabel} color="primary" size="small" sx={{ mt: 0.3 }} />
          </Box>
        </Box>

        <Divider />

        <List disablePadding>
          {navLinks.map((link) => (
            <ListItemButton
              key={link.to}
              component={RouterLink}
              to={link.to}
              selected={location.pathname === link.to}
              onClick={() => setOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{link.icon}</ListItemIcon>
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ mt: 'auto' }} />

        <List disablePadding>
          <ListItemButton onClick={() => { setOpen(false); logout(); }}>
            <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Cerrar sesión" />
          </ListItemButton>
        </List>
      </Drawer>
    </>
  );
}

import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import api from '../api/client';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Completa todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmacion no coincide con la nueva contrasena');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(data?.message || 'Contrasena actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo cambiar la contrasena');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">Cambiar contrasena</Typography>
        <Typography color="text.secondary">Actualiza tu acceso de forma segura.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <TextField
              type="password"
              label="Contrasena actual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
            />

            <TextField
              type="password"
              label="Nueva contrasena"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              fullWidth
            />

            <TextField
              type="password"
              label="Confirmar nueva contrasena"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              fullWidth
            />

            <Button type="submit" variant="contained" startIcon={<LockResetIcon />} disabled={saving}>
              Actualizar contrasena
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

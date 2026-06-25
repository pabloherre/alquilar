import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error de autenticación');
    }
  };

  const onGoogleSuccess = async ({ credential }) => {
    setError('');
    try {
      await loginWithGoogle(credential);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al autenticar con Google');
    }
  };

  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Ingresar</Typography>
            <Typography variant="body2" color="text.secondary">
              Accedé al panel de contratos y recibos.
            </Typography>
            <Stack component="form" onSubmit={onSubmit} spacing={2}>
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth inputProps={{ style: { fontSize: 16 } }} />
              <TextField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth inputProps={{ style: { fontSize: 16 } }} />
              <Button type="submit" variant="contained" size="large" startIcon={<LoginIcon />} fullWidth>
                Entrar
              </Button>
            </Stack>
            <Divider>o</Divider>
            <Box sx={{ width: '100%' }}>
              <GoogleLogin onSuccess={onGoogleSuccess} onError={() => setError('Error al autenticar con Google')} width="100%" />
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

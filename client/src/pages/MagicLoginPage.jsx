import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function MagicLoginPage() {
  const { token } = useParams();
  const { loginWithMagic } = useAuth();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loginWithMagic(token)
      .then(() => navigate('/'))
      .catch((err) => setError(err?.response?.data?.message || 'Magic link inválido'));
  }, [token, loginWithMagic, navigate]);

  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent>
          <Stack spacing={2} alignItems="center">
            {!error && <CircularProgress />}
            <Typography variant="h6">Validando acceso...</Typography>
            {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
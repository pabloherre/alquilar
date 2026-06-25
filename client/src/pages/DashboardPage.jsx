import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Fab,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateDisplay, formatMoneyNoDecimals } from '../utils/formatters';

const NEAR_EXPIRATION_DAYS = 15;

export default function DashboardPage() {
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    api.get('/contracts')
      .then((res) => setContracts(res.data))
      .catch((err) => setError(err?.response?.data?.message || 'No se pudieron cargar contratos'));
  }, []);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Contratos</Typography>
        <Typography variant="body2" color="text.secondary">
          Seguimiento de alquileres, incrementos y recibos.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {contracts.length === 0 && !error && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <AssignmentIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            No hay contratos aún
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {isAdmin ? 'Creá el primer contrato para comenzar.' : 'Tu administrador aún no asignó contratos.'}
          </Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/admin/new-contract')}
            >
              Nuevo contrato
            </Button>
          )}
        </Box>
      )}

      <Grid container spacing={2}>
        {contracts.map((c) => {
          const daysUntilExpiration = dayjs(c.expirationDate).startOf('day').diff(dayjs().startOf('day'), 'day');
          const isExpired = c.status === 'expired' || daysUntilExpiration < 0;
          const isNearExpiration = !isExpired && daysUntilExpiration >= 0 && daysUntilExpiration <= NEAR_EXPIRATION_DAYS;

          const borderColor = isExpired ? 'error.main' : isNearExpiration ? 'warning.main' : 'divider';
          const bgColor = isExpired
            ? 'rgba(211, 47, 47, 0.06)'
            : isNearExpiration
              ? 'rgba(237, 108, 2, 0.08)'
              : 'background.paper';

          return (
            <Grid item xs={12} sm={6} md={4} key={c._id}>
              <Card sx={{ height: '100%', border: '1px solid', borderColor, backgroundColor: bgColor }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                      <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                        {c.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexShrink={0}>
                        <Chip label={c.indexType} size="small" color="secondary" sx={{ color: 'common.white' }} />
                        {isExpired && <Chip label="Expirado" size="small" color="error" />}
                        {isNearExpiration && <Chip label="Por vencer" size="small" color="warning" />}
                      </Stack>
                    </Stack>

                    <Typography variant="h5" component="p" color="primary.main" fontWeight={700}>
                      {formatMoneyNoDecimals(c.currentAmountUsd)}
                    </Typography>

                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Box>
                        <Typography variant="caption" color="text.disabled" display="block">Próx. incremento</Typography>
                        <Typography variant="body2" fontWeight={500}>{formatDateDisplay(c.nextIncrementDate)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.disabled" display="block">Vence</Typography>
                        <Typography variant="body2" fontWeight={500}>{formatDateDisplay(c.expirationDate)}</Typography>
                      </Box>
                    </Stack>

                    {c.tenant?.name && (
                      <Typography variant="caption" color="text.secondary">
                        Inquilino: <strong>{c.tenant.name}</strong>
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    component={RouterLink}
                    to={`/contracts/${c._id}`}
                    startIcon={<VisibilityIcon />}
                    variant="outlined"
                    fullWidth
                  >
                    Ver detalle
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {isAdmin && (
        <Fab
          color="primary"
          onClick={() => navigate('/admin/new-contract')}
          aria-label="Nuevo contrato"
          sx={{
            position: 'fixed',
            bottom: 'calc(24px + env(safe-area-inset-bottom))',
            right: 24,
            display: { xs: 'flex', md: 'none' }
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Stack>
  );
}

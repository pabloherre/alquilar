import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardActions, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import api from '../api/client';
import { formatDateDisplay, formatMoneyNoDecimals } from '../utils/formatters';

const NEAR_EXPIRATION_DAYS = 15;

export default function DashboardPage() {
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/contracts')
      .then((res) => setContracts(res.data))
      .catch((err) => setError(err?.response?.data?.message || 'No se pudieron cargar contratos'));
  }, []);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">Contratos</Typography>
        <Typography color="text.secondary">Seguimiento de alquileres, incrementos y recibos.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {contracts.map((c) => {
          const daysUntilExpiration = dayjs(c.expirationDate).startOf('day').diff(dayjs().startOf('day'), 'day');
          const isExpired = c.status === 'expired' || daysUntilExpiration < 0;
          const isNearExpiration = !isExpired && daysUntilExpiration >= 0 && daysUntilExpiration <= NEAR_EXPIRATION_DAYS;

          const cardSx = {
            height: '100%',
            border: '1px solid',
            borderColor: isExpired ? 'error.main' : isNearExpiration ? 'warning.main' : 'divider',
            backgroundColor: isExpired
              ? 'rgba(211, 47, 47, 0.06)'
              : isNearExpiration
                ? 'rgba(237, 108, 2, 0.08)'
                : 'background.paper'
          };

          return (
            <Grid item xs={12} sm={6} md={4} key={c._id}>
              <Card sx={cardSx}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{c.title}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip label={c.indexType} size="small" color="secondary" sx={{ width: 'fit-content', color: 'common.white' }} />
                      {isExpired && <Chip label="Expirado" size="small" color="error" variant="filled" />}
                      {isNearExpiration && <Chip label="Proximo a vencer" size="small" color="warning" variant="filled" />}
                    </Stack>
                    <Typography variant="body2">Monto actual: <strong>{formatMoneyNoDecimals(c.currentAmountUsd)}</strong></Typography>
                    <Typography variant="body2">Siguiente incremento: <strong>{formatDateDisplay(c.nextIncrementDate)}</strong></Typography>
                    <Typography variant="body2">Vence: <strong>{formatDateDisplay(c.expirationDate)}</strong></Typography>
                    {c.tenant?.name && <Typography variant="body2">Inquilino: <strong>{c.tenant.name}</strong></Typography>}
                  </Stack>
                </CardContent>
                <CardActions>
                  <Button component={RouterLink} to={`/contracts/${c._id}`} startIcon={<VisibilityIcon />}>
                    Ver detalle
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}

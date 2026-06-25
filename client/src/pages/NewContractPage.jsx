import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Link,
  useMediaQuery,
  useTheme
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';

const INDEXES = ['ICL', 'IPC', 'CasaPropia', 'CAC', 'CER', 'IS', 'IPIM', 'UVA', 'OTHER'];
const INPUT_STYLE = { style: { fontSize: 16 } };

export default function NewContractPage() {
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [form, setForm] = useState({
    title: '',
    tenantId: '',
    startDate: '',
    baseAmountUsd: '',
    incrementFrequencyMonths: 3,
    durationYears: 2,
    indexType: 'ICL',
    manualOverridePercent: 0
  });

  const [newTenant, setNewTenant] = useState({ name: '', email: '', password: '' });
  const [magicLink, setMagicLink] = useState('');
  const navigate = useNavigate();

  const loadTenants = async () => {
    const { data } = await api.get('/auth/admin/users');
    setTenants(data);
  };

  useEffect(() => {
    loadTenants().catch(() => setError('No se pudieron cargar inquilinos'));
  }, []);

  const createTenant = async () => {
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/auth/admin/users', newTenant);
      await loadTenants();
      setForm((f) => ({ ...f, tenantId: data.id }));
      setNewTenant({ name: '', email: '', password: '' });
      setSuccess('Inquilino creado correctamente');
      setTenantDialogOpen(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo crear el inquilino');
    }
  };

  const generateMagicLink = async () => {
    setError('');
    if (!form.tenantId) { setError('Seleccioná un inquilino antes de generar el magic link'); return; }
    try {
      const { data } = await api.post('/auth/magic-link/request', { userId: form.tenantId });
      setMagicLink(data.link);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo generar el magic link');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/contracts', {
        ...form,
        baseAmountUsd: Number(form.baseAmountUsd),
        incrementFrequencyMonths: Number(form.incrementFrequencyMonths),
        durationYears: Number(form.durationYears),
        manualOverridePercent: Number(form.manualOverridePercent)
      });
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo crear el contrato');
    }
  };

  const tenantForm = (
    <Stack spacing={2}>
      <TextField label="Nombre" value={newTenant.name} onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
      <TextField label="Email" value={newTenant.email} onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
      <TextField label="Contraseña inicial" type="password" value={newTenant.password} onChange={(e) => setNewTenant({ ...newTenant, password: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
    </Stack>
  );

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Nuevo contrato</Typography>
        <Typography variant="body2" color="text.secondary">Carga rápida de contrato e inquilino desde una sola pantalla.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack component="form" onSubmit={submit} spacing={2}>
                <TextField label="Título" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} inputProps={INPUT_STYLE} fullWidth />
                <TextField select label="Inquilino" required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} fullWidth inputProps={INPUT_STYLE}>
                  <MenuItem value="">Seleccionar</MenuItem>
                  {tenants.map((t) => <MenuItem key={t._id || t.id} value={t._id || t.id}>{t.name} ({t.email})</MenuItem>)}
                </TextField>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField type="date" label="Fecha inicio" required fullWidth InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} inputProps={{ style: { fontSize: 16 } }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField type="number" label="Monto inicial ARS" required fullWidth inputProps={{ step: '0.01', style: { fontSize: 16 } }} value={form.baseAmountUsd} onChange={(e) => setForm({ ...form, baseAmountUsd: e.target.value })} />
                  </Grid>
                </Grid>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="Frecuencia (meses)" fullWidth value={form.incrementFrequencyMonths} onChange={(e) => setForm({ ...form, incrementFrequencyMonths: e.target.value })} inputProps={{ style: { fontSize: 16 } }}>
                      {[2, 3, 4, 6, 12].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField type="number" label="Duración (años)" fullWidth inputProps={{ min: 1, style: { fontSize: 16 } }} value={form.durationYears} onChange={(e) => setForm({ ...form, durationYears: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="Índice" fullWidth value={form.indexType} onChange={(e) => setForm({ ...form, indexType: e.target.value })} inputProps={{ style: { fontSize: 16 } }}>
                      {INDEXES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>

                <TextField type="number" label="Override % (interno)" fullWidth inputProps={{ step: '0.01', style: { fontSize: 16 } }} value={form.manualOverridePercent} onChange={(e) => setForm({ ...form, manualOverridePercent: e.target.value })} />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                  <Button type="submit" variant="contained" startIcon={<SaveIcon />} fullWidth={isMobile}>Guardar contrato</Button>
                  <Button type="button" variant="outlined" startIcon={<LinkIcon />} onClick={generateMagicLink} fullWidth={isMobile}>Generar magic link</Button>
                  <Button type="button" variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setTenantDialogOpen(true)} fullWidth={isMobile} sx={{ display: { md: 'none' } }}>
                    Crear inquilino
                  </Button>
                </Stack>
                {magicLink && <Link href={magicLink} target="_blank" rel="noreferrer">Abrir enlace mágico</Link>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Crear inquilino</Typography>
                {tenantForm}
                <Divider />
                <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={createTenant}>Crear y asignar</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={tenantDialogOpen} onClose={() => setTenantDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear inquilino</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {tenantForm}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTenantDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={createTenant}>Crear y asignar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaymentIcon from '@mui/icons-material/Payment';
import PreviewIcon from '@mui/icons-material/Preview';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DownloadIcon from '@mui/icons-material/Download';
import LinkIcon from '@mui/icons-material/Link';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProjectionChart from '../components/ProjectionChart';
import {
  formatCompactMoney,
  formatDateDisplay,
  formatMoneyNoDecimals,
  formatMonthYearDisplay
} from '../utils/formatters';

const NEAR_INCREMENT_DAYS = 15;
const NEAR_EXPIRATION_DAYS = 15;
const INDEXES = ['ICL', 'IPC', 'CasaPropia', 'CAC', 'CER', 'IS', 'IPIM', 'UVA', 'OTHER'];

const SOURCE_LABELS = {
  start: 'Inicio',
  manual_next_amount: 'Manual confirmado',
  estimated_manual_next: 'Manual estimado',
  estimated_increment: 'Indice estimado',
  confirmed_increment: 'Indice confirmado',
  arquiler_api: 'Indice API',
  manual_override: 'Override'
};

function statusChip(status) {
  if (status === 'paid') return <Chip size="small" color="success" label="Pagada" />;
  if (status === 'past') return <Chip size="small" color="warning" label="Pasada" />;
  if (status === 'current') return <Chip size="small" color="info" label="Actual" />;
  return <Chip size="small" label="Futura" />;
}

function InstallmentCard({ row, isAdmin, onDownload, onGenerate, generatingKey }) {
  const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
  return (
    <Card variant="outlined" sx={{ p: 0 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {formatMonthYearDisplay(row.periodStart)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMoneyNoDecimals(row.amountUsd)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {statusChip(row.status)}
            {row.receiptId && (
              <Button
                size="small"
                variant="text"
                startIcon={<DownloadIcon />}
                onClick={() => onDownload(row.receiptId, row.year, row.month)}
              >
                Recibo
              </Button>
            )}
            {isAdmin && (
              <Button
                size="small"
                variant={row.receiptId ? 'outlined' : 'contained'}
                startIcon={<PaymentIcon />}
                onClick={() => onGenerate(row.year, row.month)}
                disabled={generatingKey === key}
              >
                {row.receiptId ? 'Regen.' : 'Generar'}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [contract, setContract] = useState(null);
  const [projection, setProjection] = useState([]);
  const [preview, setPreview] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [error, setError] = useState('');

  const [manualNextAmountInput, setManualNextAmountInput] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const [magicLink, setMagicLink] = useState('');
  const [generatingMagicLink, setGeneratingMagicLink] = useState(false);

  const [renewStartDateInput, setRenewStartDateInput] = useState('');
  const [renewBaseAmountInput, setRenewBaseAmountInput] = useState('');
  const [renewDurationYearsInput, setRenewDurationYearsInput] = useState('');
  const [renewing, setRenewing] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '',
    tenantId: '',
    startDate: '',
    baseAmountUsd: '',
    incrementFrequencyMonths: 3,
    durationYears: 2,
    indexType: 'ICL',
    manualOverridePercent: 0
  });
  const [tenants, setTenants] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [generatingReceiptKey, setGeneratingReceiptKey] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    const [c, p, s] = await Promise.all([
      api.get(`/contracts/${id}`),
      api.get(`/contracts/${id}/projection`),
      api.get(`/contracts/${id}/installments`)
    ]);

    setContract(c.data);
    setProjection(p.data.points || []);
    setInstallments(s.data.installments || []);

    setManualNextAmountInput(
      c.data.manualNextAmountUsd !== null && c.data.manualNextAmountUsd !== undefined
        ? String(c.data.manualNextAmountUsd)
        : ''
    );
    setRenewStartDateInput(dayjs(c.data.expirationDate).format('YYYY-MM-DD'));
    setRenewBaseAmountInput(String(c.data.currentAmountUsd || c.data.baseAmountUsd || ''));
    setRenewDurationYearsInput(String(c.data.durationYears || ''));

    setEditForm({
      title: c.data.title || '',
      tenantId: c.data.tenant?._id || c.data.tenant || '',
      startDate: dayjs(c.data.startDate).format('YYYY-MM-DD'),
      baseAmountUsd: String(c.data.baseAmountUsd ?? ''),
      incrementFrequencyMonths: Number(c.data.incrementFrequencyMonths || 3),
      durationYears: Number(c.data.durationYears || 2),
      indexType: c.data.indexType || 'ICL',
      manualOverridePercent: Number(c.data.manualOverridePercent || 0)
    });
  };

  useEffect(() => {
    load().catch((err) => setError(err?.response?.data?.message || 'No se pudo cargar el contrato'));
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/auth/admin/users')
      .then((res) => setTenants(res.data || []))
      .catch(() => setTenants([]));
  }, [isAdmin]);

  const previewIncrement = async () => {
    const { data } = await api.post(`/contracts/${id}/increments/preview`);
    setPreview(data);
  };

  const confirmIncrement = async () => {
    await api.post(`/contracts/${id}/increments/confirm`);
    await load();
    setPreview(null);
  };

  const genReceipt = async () => {
    await api.post(`/contracts/${id}/receipts/generate`);
    await load();
  };

  const saveContractEdits = async () => {
    setError('');
    const payload = {
      title: editForm.title,
      tenantId: editForm.tenantId,
      startDate: editForm.startDate,
      baseAmountUsd: Number(editForm.baseAmountUsd),
      incrementFrequencyMonths: Number(editForm.incrementFrequencyMonths),
      durationYears: Number(editForm.durationYears),
      indexType: editForm.indexType,
      manualOverridePercent: Number(editForm.manualOverridePercent)
    };

    if (!payload.title || !payload.tenantId || !payload.startDate || !Number.isFinite(payload.baseAmountUsd) || payload.baseAmountUsd <= 0) {
      setError('Completa titulo, inquilino, fecha de inicio y monto base valido');
      return;
    }

    setSavingEdit(true);
    try {
      await api.patch(`/contracts/${id}`, payload);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo editar el contrato');
    } finally {
      setSavingEdit(false);
    }
  };

  const downloadReceiptById = async (receiptId, year, month) => {
    setError('');
    try {
      const response = await api.get(`/receipts/${receiptId}/download`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `recibo-${id}-${year}-${String(month).padStart(2, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo descargar el comprobante');
    }
  };

  const genReceiptForMonth = async (year, month) => {
    setError('');
    const key = `${year}-${String(month).padStart(2, '0')}`;
    setGeneratingReceiptKey(key);
    try {
      const { data } = await api.post(`/contracts/${id}/receipts/generate`, null, { params: { year, month } });
      await load();
      if (data?._id) await downloadReceiptById(data._id, year, month);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo generar el comprobante para ese periodo');
    } finally {
      setGeneratingReceiptKey('');
    }
  };

  const generateMagicLinkForContract = async () => {
    setError('');
    setGeneratingMagicLink(true);
    try {
      const tenantId = contract?.tenant?._id || contract?.tenant;
      if (!tenantId) throw new Error('Contrato sin inquilino asignado');
      const { data } = await api.post('/auth/magic-link/request', { userId: tenantId });
      setMagicLink(data.link || '');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'No se pudo generar el magic link');
    } finally {
      setGeneratingMagicLink(false);
    }
  };

  const saveManualNextAmount = async () => {
    setError('');
    const value = Number(manualNextAmountInput);
    if (!Number.isFinite(value) || value <= 0) {
      setError('El monto manual debe ser un numero mayor a 0');
      return;
    }
    setSavingManual(true);
    try {
      await api.patch(`/contracts/${id}`, { manualNextAmountUsd: value });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo guardar el monto manual');
    } finally {
      setSavingManual(false);
    }
  };

  const clearManualNextAmount = async () => {
    setError('');
    setSavingManual(true);
    try {
      await api.patch(`/contracts/${id}`, { manualNextAmountUsd: null });
      await load();
      setPreview(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo limpiar el monto manual');
    } finally {
      setSavingManual(false);
    }
  };

  const renewContract = async () => {
    setError('');
    const baseAmount = Number(renewBaseAmountInput);
    const durationYears = Number(renewDurationYearsInput);
    if (!renewStartDateInput) { setError('La fecha de inicio del nuevo contrato es obligatoria'); return; }
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) { setError('El monto inicial debe ser mayor a 0'); return; }
    if (!Number.isFinite(durationYears) || durationYears <= 0) { setError('La duracion debe ser mayor a 0'); return; }
    setRenewing(true);
    try {
      const { data } = await api.post(`/contracts/${id}/renew`, { startDate: renewStartDateInput, baseAmountUsd: baseAmount, durationYears });
      if (data?.newContract?._id) { navigate(`/contracts/${data.newContract._id}`); return; }
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo renovar el contrato');
    } finally {
      setRenewing(false);
    }
  };

  if (!contract) return <Typography sx={{ p: 3 }}>Cargando...</Typography>;

  const periodMonths = Number(contract.incrementFrequencyMonths || 0);
  const periodEnd = dayjs(contract.nextIncrementDate).startOf('month').format('YYYY-MM-DD');
  const periodStart = dayjs(contract.nextIncrementDate).subtract(periodMonths, 'month').startOf('month').format('YYYY-MM-DD');

  const daysUntilIncrement = dayjs(contract.nextIncrementDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  const isIncrementOverdue = daysUntilIncrement < 0;
  const isIncrementNear = daysUntilIncrement >= 0 && daysUntilIncrement <= NEAR_INCREMENT_DAYS;
  const nextIncrementChipColor = isIncrementOverdue ? 'error' : isIncrementNear ? 'warning' : 'default';

  const daysUntilExpiration = dayjs(contract.expirationDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  const isExpirationOverdue = daysUntilExpiration < 0;
  const isExpirationNear = daysUntilExpiration >= 0 && daysUntilExpiration <= NEAR_EXPIRATION_DAYS;
  const expirationChipColor = isExpirationOverdue ? 'error' : isExpirationNear ? 'warning' : 'default';

  const isContractExpired = contract.status === 'expired';

  const infoContent = (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Box>
          <Typography variant="caption" color="text.disabled">Monto actual</Typography>
          <Typography variant="h5" fontWeight={700} color="primary.main">
            {formatMoneyNoDecimals(contract.currentAmountUsd)}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={`Índice: ${contract.indexType}`} color="secondary" size="small" sx={{ color: 'common.white' }} />
        <Chip label={`Próx. incremento: ${formatDateDisplay(contract.nextIncrementDate)}`} size="small" color={nextIncrementChipColor} />
        <Chip label={`Vence: ${formatDateDisplay(contract.expirationDate)}`} size="small" color={expirationChipColor} />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Inquilino: <strong>{contract.tenant?.name}</strong>
      </Typography>

      {isContractExpired && <Alert severity="error">Este contrato está marcado como expirado.</Alert>}
      {(isIncrementNear || isIncrementOverdue) && (
        <Alert severity={isIncrementOverdue ? 'error' : 'warning'}>
          {isIncrementOverdue
            ? `El incremento está vencido desde hace ${Math.abs(daysUntilIncrement)} días.`
            : `Faltan ${daysUntilIncrement} días para el próximo incremento.`}
        </Alert>
      )}
      {(isExpirationNear || isExpirationOverdue) && (
        <Alert severity={isExpirationOverdue ? 'error' : 'warning'}>
          {isExpirationOverdue
            ? `El contrato está vencido desde hace ${Math.abs(daysUntilExpiration)} días.`
            : `Faltan ${daysUntilExpiration} días para el vencimiento del contrato.`}
        </Alert>
      )}
      {contract.manualNextAmountUsd !== null && contract.manualNextAmountUsd !== undefined && (
        <Alert severity="info">Próxima cuota manual pendiente: {formatCompactMoney(contract.manualNextAmountUsd)}</Alert>
      )}
    </Stack>
  );

  const chartContent = (
    <ProjectionChart
      data={projection}
      currentPeriodStart={periodStart}
      currentPeriodEnd={periodEnd}
      periodMonths={periodMonths}
      height={isMobile ? 200 : 300}
    />
  );

  const installmentsContent = isMobile ? (
    <Stack spacing={1}>
      {installments.map((row) => (
        <InstallmentCard
          key={`${row.year}-${row.month}`}
          row={row}
          isAdmin={isAdmin}
          onDownload={downloadReceiptById}
          onGenerate={genReceiptForMonth}
          generatingKey={generatingReceiptKey}
        />
      ))}
    </Stack>
  ) : (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Periodo</TableCell>
            <TableCell>Monto</TableCell>
            {isAdmin && <TableCell>Origen</TableCell>}
            <TableCell>Estado</TableCell>
            <TableCell>Comprobante</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {installments.map((row) => (
            <TableRow key={`${row.year}-${row.month}`} hover>
              <TableCell>{formatMonthYearDisplay(row.periodStart)}</TableCell>
              <TableCell>{formatMoneyNoDecimals(row.amountUsd)}</TableCell>
              {isAdmin && <TableCell>{SOURCE_LABELS[row.source] || row.source}</TableCell>}
              <TableCell>{statusChip(row.status)}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {row.receiptId ? (
                    <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={() => downloadReceiptById(row.receiptId, row.year, row.month)}>
                      Descargar
                    </Button>
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                  {isAdmin && (
                    <Button
                      size="small"
                      variant={row.receiptId ? 'outlined' : 'contained'}
                      startIcon={<PaymentIcon />}
                      onClick={() => genReceiptForMonth(row.year, row.month)}
                      disabled={generatingReceiptKey === `${row.year}-${String(row.month).padStart(2, '0')}`}
                    >
                      {row.receiptId ? 'Regenerar' : 'Generar'}
                    </Button>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const adminContent = isAdmin && (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Editar contrato</Typography>
            <TextField label="Titulo" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }} />
            <TextField select label="Inquilino" value={editForm.tenantId} onChange={(e) => setEditForm((f) => ({ ...f, tenantId: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }}>
              <MenuItem value="">Seleccionar</MenuItem>
              {tenants.map((t) => <MenuItem key={t._id || t.id} value={t._id || t.id}>{t.name} ({t.email})</MenuItem>)}
            </TextField>
            <TextField type="date" label="Fecha inicio" InputLabelProps={{ shrink: true }} value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }} />
            <TextField type="number" label="Monto inicial ARS" inputProps={{ step: '0.01', min: 0, style: { fontSize: 16 } }} value={editForm.baseAmountUsd} onChange={(e) => setEditForm((f) => ({ ...f, baseAmountUsd: e.target.value }))} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Frecuencia (meses)" value={editForm.incrementFrequencyMonths} onChange={(e) => setEditForm((f) => ({ ...f, incrementFrequencyMonths: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }}>
                {[2, 3, 4, 6, 12].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              <TextField type="number" label="Duracion (años)" inputProps={{ min: 1, style: { fontSize: 16 } }} value={editForm.durationYears} onChange={(e) => setEditForm((f) => ({ ...f, durationYears: e.target.value }))} fullWidth />
              <TextField select label="Indice" value={editForm.indexType} onChange={(e) => setEditForm((f) => ({ ...f, indexType: e.target.value }))} fullWidth inputProps={{ style: { fontSize: 16 } }}>
                {INDEXES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField type="number" label="Override % (interno)" inputProps={{ step: '0.01', style: { fontSize: 16 } }} value={editForm.manualOverridePercent} onChange={(e) => setEditForm((f) => ({ ...f, manualOverridePercent: e.target.value }))} fullWidth />
            <Button variant="contained" onClick={saveContractEdits} disabled={savingEdit} fullWidth={isMobile}>
              Guardar cambios del contrato
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Divider />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField type="number" label="Proxima cuota manual ARS" inputProps={{ step: '0.01', min: 0, style: { fontSize: 16 } }} value={manualNextAmountInput} onChange={(e) => setManualNextAmountInput(e.target.value)} fullWidth />
        <Button variant="contained" onClick={saveManualNextAmount} disabled={savingManual} sx={{ flexShrink: 0 }}>Guardar</Button>
        <Button variant="outlined" onClick={clearManualNextAmount} disabled={savingManual} sx={{ flexShrink: 0 }}>Limpiar</Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
        <Button variant="outlined" startIcon={<PreviewIcon />} onClick={previewIncrement} fullWidth={isMobile}>Previsualizar incremento</Button>
        <Button variant="contained" startIcon={<TaskAltIcon />} onClick={confirmIncrement} fullWidth={isMobile}>Confirmar incremento</Button>
        <Button variant="outlined" startIcon={<PaymentIcon />} onClick={genReceipt} fullWidth={isMobile}>Generar recibo del mes</Button>
        <Button variant="outlined" startIcon={<LinkIcon />} onClick={generateMagicLinkForContract} disabled={generatingMagicLink} fullWidth={isMobile}>
          Generar magic link
        </Button>
      </Stack>

      {magicLink && (
        <Alert severity="info">
          Magic link: <Link href={magicLink} target="_blank" rel="noreferrer">Abrir enlace</Link>
        </Alert>
      )}
      {preview && (
        <Alert severity="success">
          Incremento según índice {contract.indexType}: {preview.percent.toFixed(2)}% → {formatCompactMoney(preview.newAmount)}
        </Alert>
      )}

      <Divider />

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>Expirar y crear nuevo contrato</Typography>
            <TextField type="date" label="Inicio nuevo contrato" InputLabelProps={{ shrink: true }} value={renewStartDateInput} onChange={(e) => setRenewStartDateInput(e.target.value)} fullWidth inputProps={{ style: { fontSize: 16 } }} />
            <TextField type="number" label="Monto inicial ARS" inputProps={{ step: '0.01', min: 0, style: { fontSize: 16 } }} value={renewBaseAmountInput} onChange={(e) => setRenewBaseAmountInput(e.target.value)} fullWidth />
            <TextField type="number" label="Duracion (años)" inputProps={{ step: '1', min: 1, style: { fontSize: 16 } }} value={renewDurationYearsInput} onChange={(e) => setRenewDurationYearsInput(e.target.value)} fullWidth />
            <Button variant="contained" color="warning" onClick={renewContract} disabled={renewing} fullWidth={isMobile}>
              Expirar contrato y crear nuevo
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Contratos
        </Button>

        <Typography variant="h5" fontWeight={700}>{contract.title}</Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Información del contrato</Typography>
          </AccordionSummary>
          <AccordionDetails>{infoContent}</AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Proyección</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>{chartContent}</AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Cuotas e historial</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1 }}>{installmentsContent}</AccordionDetails>
        </Accordion>

        {isAdmin && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Gestión</Typography>
            </AccordionSummary>
            <AccordionDetails>{adminContent}</AccordionDetails>
          </Accordion>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ alignSelf: 'flex-start' }}>
        Contratos
      </Button>

      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{
        border: isContractExpired ? '1px solid' : 'none',
        borderColor: isContractExpired ? 'error.main' : 'transparent',
        backgroundColor: isContractExpired ? 'rgba(211, 47, 47, 0.06)' : 'background.paper'
      }}>
        <CardContent>
          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
            <Typography variant="h5">{contract.title}</Typography>
          </Stack>
          {infoContent}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card sx={{
          border: isContractExpired ? '1px solid' : 'none',
          borderColor: isContractExpired ? 'error.main' : 'transparent',
          backgroundColor: isContractExpired ? 'rgba(211, 47, 47, 0.06)' : 'background.paper'
        }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Acciones de administración</Typography>
            {adminContent}
          </CardContent>
        </Card>
      )}

      {chartContent}

      <Card sx={{
        border: isContractExpired ? '1px solid' : 'none',
        borderColor: isContractExpired ? 'error.main' : 'transparent',
        backgroundColor: isContractExpired ? 'rgba(211, 47, 47, 0.06)' : 'background.paper'
      }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Cuotas del contrato (histórico + proyección)</Typography>
          {installmentsContent}
        </CardContent>
      </Card>
    </Stack>
  );
}

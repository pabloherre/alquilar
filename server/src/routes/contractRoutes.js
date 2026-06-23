import { Router } from 'express';
import dayjs from 'dayjs';
import { Contract } from '../models/Contract.js';
import { User } from '../models/User.js';
import { Receipt } from '../models/Receipt.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { addMonths, addYears, startOfMonth, roundUsd } from '../utils/dateMath.js';
import { getSuggestedIncrement } from '../services/indexProvider.js';
import { buildProjectionFromHistoryWithEstimates } from '../utils/projection.js';

const router = Router();

router.use(authRequired);

async function buildIncrementPreview(contract) {
  const oldAmount = Number(contract.currentAmountUsd);

  if (contract.manualNextAmountUsd !== null && contract.manualNextAmountUsd !== undefined) {
    const manualAmount = roundUsd(Number(contract.manualNextAmountUsd));
    const percent = oldAmount > 0 ? roundUsd(((manualAmount - oldAmount) / oldAmount) * 100) : 0;

    return {
      effectiveDate: startOfMonth(contract.nextIncrementDate),
      percent,
      source: 'manual_next_amount',
      oldAmount,
      newAmount: manualAmount
    };
  }

  return getSuggestedIncrement(contract);
}

function assertContractAccess(contract, user) {
  if (!contract) return { ok: false, status: 404, message: 'Contrato no encontrado' };
  if (user.role !== 'admin' && String(contract.tenant) !== user.id && String(contract.tenant?._id) !== user.id) {
    return { ok: false, status: 403, message: 'Sin permisos' };
  }
  return { ok: true };
}

function buildInstallmentsFromProjection(contract, projectionPoints, receipts) {
  const sortedPoints = [...projectionPoints].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const receiptMap = new Map((receipts || []).map((r) => [`${r.year}-${String(r.month).padStart(2, '0')}`, r]));
  const currentMonthStart = dayjs().startOf('month');

  const installments = [];
  let pointIndex = 0;
  let activePoint = sortedPoints[0] || {
    date: dayjs(contract.startDate).format('YYYY-MM-DD'),
    amountUsd: Number(contract.baseAmountUsd),
    event: 'start'
  };

  let cursor = dayjs(contract.startDate).startOf('month');
  const end = dayjs(contract.expirationDate).startOf('month');

  while (cursor.isBefore(end)) {
    while (
      pointIndex + 1 < sortedPoints.length &&
      !dayjs(sortedPoints[pointIndex + 1].date).startOf('month').isAfter(cursor)
    ) {
      pointIndex += 1;
      activePoint = sortedPoints[pointIndex];
    }

    const year = cursor.year();
    const month = cursor.month() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const receipt = receiptMap.get(key);
    const paid = Boolean(receipt);

    let status = 'upcoming';
    if (paid) status = 'paid';
    else if (cursor.isBefore(currentMonthStart)) status = 'past';
    else if (cursor.isSame(currentMonthStart)) status = 'current';

    installments.push({
      periodStart: cursor.format('YYYY-MM-DD'),
      periodEnd: cursor.endOf('month').format('YYYY-MM-DD'),
      year,
      month,
      amountUsd: roundUsd(Number(activePoint.amountUsd)),
      source: activePoint.event,
      isManual: String(activePoint.event || '').includes('manual'),
      paid,
      status,
      receiptId: receipt?._id || null
    });

    cursor = cursor.add(1, 'month');
  }

  return installments;
}

router.post('/', requireRole('admin'), async (req, res) => {
  const {
    title,
    tenantId,
    startDate,
    baseAmountUsd,
    incrementFrequencyMonths,
    durationYears,
    indexType,
    manualOverridePercent,
    manualNextAmountUsd
  } = req.body;

  const tenant = await User.findById(tenantId);
  if (!tenant || tenant.role !== 'user') return res.status(404).json({ message: 'Inquilino no válido' });

  const start = startOfMonth(startDate);
  const expirationDate = startOfMonth(addYears(start, Number(durationYears)));
  const nextIncrementDate = startOfMonth(addMonths(start, Number(incrementFrequencyMonths)));

  const parsedManualNextAmount =
    manualNextAmountUsd === null || manualNextAmountUsd === undefined || manualNextAmountUsd === ''
      ? null
      : roundUsd(Number(manualNextAmountUsd));

  const contract = await Contract.create({
    title,
    adminOwner: req.user.id,
    tenant: tenant._id,
    startDate: start,
    expirationDate,
    incrementFrequencyMonths,
    durationYears,
    indexType,
    manualOverridePercent: Number(manualOverridePercent || 0),
    manualNextAmountUsd: parsedManualNextAmount,
    baseAmountUsd: roundUsd(baseAmountUsd),
    currentAmountUsd: roundUsd(baseAmountUsd),
    nextIncrementDate,
    status: 'active'
  });

  res.status(201).json(contract);
});

router.post('/:id/renew', requireRole('admin'), async (req, res) => {
  const currentContract = await Contract.findById(req.params.id);
  if (!currentContract) return res.status(404).json({ message: 'Contrato no encontrado' });

  const {
    startDate,
    baseAmountUsd,
    durationYears,
    title,
    indexType,
    incrementFrequencyMonths,
    manualOverridePercent
  } = req.body;

  if (!startDate || baseAmountUsd === undefined || baseAmountUsd === null) {
    return res.status(400).json({ message: 'startDate y baseAmountUsd son requeridos para renovar' });
  }

  const nextStart = startOfMonth(startDate);
  const nextDurationYears = Number(durationYears || currentContract.durationYears);
  const nextFrequency = Number(incrementFrequencyMonths || currentContract.incrementFrequencyMonths);
  const nextIndexType = indexType || currentContract.indexType;
  const nextManualOverride =
    manualOverridePercent === undefined || manualOverridePercent === null
      ? Number(currentContract.manualOverridePercent || 0)
      : Number(manualOverridePercent);

  const newContract = await Contract.create({
    title: title || `${currentContract.title} (renovación)`,
    adminOwner: currentContract.adminOwner,
    tenant: currentContract.tenant,
    startDate: nextStart,
    expirationDate: startOfMonth(addYears(nextStart, nextDurationYears)),
    incrementFrequencyMonths: nextFrequency,
    durationYears: nextDurationYears,
    indexType: nextIndexType,
    manualOverridePercent: nextManualOverride,
    manualNextAmountUsd: null,
    baseAmountUsd: roundUsd(baseAmountUsd),
    currentAmountUsd: roundUsd(baseAmountUsd),
    nextIncrementDate: startOfMonth(addMonths(nextStart, nextFrequency)),
    status: 'active'
  });

  currentContract.status = 'expired';
  await currentContract.save();

  res.status(201).json({
    message: 'Contrato renovado correctamente',
    expiredContractId: currentContract._id,
    newContract
  });
});

router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { tenant: req.user.id };
  const contracts = await Contract.find(filter)
    .populate('tenant', 'name email')
    .populate('adminOwner', 'name email')
    .sort({ createdAt: -1 });
  res.json(contracts);
});

router.get('/:id', async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate('tenant', 'name email')
    .populate('adminOwner', 'name email');

  const access = assertContractAccess(contract, req.user);
  if (!access.ok) return res.status(access.status).json({ message: access.message });

  res.json(contract);
});

router.patch('/:id', requireRole('admin'), async (req, res) => {
  const contract = await Contract.findById(req.params.id);
  if (!contract) return res.status(404).json({ message: 'Contrato no encontrado' });

  const updates = {};

  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.indexType !== undefined) updates.indexType = req.body.indexType;
  if (req.body.status !== undefined) updates.status = req.body.status;

  if (req.body.manualOverridePercent !== undefined) {
    updates.manualOverridePercent = Number(req.body.manualOverridePercent || 0);
  }

  if (req.body.manualNextAmountUsd !== undefined) {
    if (req.body.manualNextAmountUsd === null || req.body.manualNextAmountUsd === '') {
      updates.manualNextAmountUsd = null;
    } else {
      const parsedManual = Number(req.body.manualNextAmountUsd);
      if (!Number.isFinite(parsedManual) || parsedManual <= 0) {
        return res.status(400).json({ message: 'manualNextAmountUsd debe ser mayor a 0 o null' });
      }
      updates.manualNextAmountUsd = roundUsd(parsedManual);
    }
  }

  if (req.body.tenantId !== undefined) {
    const tenant = await User.findById(req.body.tenantId);
    if (!tenant || tenant.role !== 'user') {
      return res.status(404).json({ message: 'Inquilino no válido' });
    }
    updates.tenant = tenant._id;
  }

  const nextStartDate = req.body.startDate !== undefined
    ? startOfMonth(req.body.startDate)
    : contract.startDate;

  const nextFrequency = req.body.incrementFrequencyMonths !== undefined
    ? Number(req.body.incrementFrequencyMonths)
    : Number(contract.incrementFrequencyMonths);

  const nextDurationYears = req.body.durationYears !== undefined
    ? Number(req.body.durationYears)
    : Number(contract.durationYears);

  if (req.body.startDate !== undefined) updates.startDate = nextStartDate;
  if (req.body.incrementFrequencyMonths !== undefined) updates.incrementFrequencyMonths = nextFrequency;
  if (req.body.durationYears !== undefined) updates.durationYears = nextDurationYears;

  if (req.body.baseAmountUsd !== undefined) {
    const parsedBase = Number(req.body.baseAmountUsd);
    if (!Number.isFinite(parsedBase) || parsedBase <= 0) {
      return res.status(400).json({ message: 'baseAmountUsd debe ser mayor a 0' });
    }
    updates.baseAmountUsd = roundUsd(parsedBase);

    if (req.body.currentAmountUsd === undefined) {
      updates.currentAmountUsd = roundUsd(parsedBase);
    }
  }

  if (req.body.currentAmountUsd !== undefined) {
    const parsedCurrent = Number(req.body.currentAmountUsd);
    if (!Number.isFinite(parsedCurrent) || parsedCurrent <= 0) {
      return res.status(400).json({ message: 'currentAmountUsd debe ser mayor a 0' });
    }
    updates.currentAmountUsd = roundUsd(parsedCurrent);
  }

  if (req.body.expirationDate !== undefined) {
    updates.expirationDate = startOfMonth(req.body.expirationDate);
  } else if (req.body.startDate !== undefined || req.body.durationYears !== undefined) {
    updates.expirationDate = startOfMonth(addYears(nextStartDate, nextDurationYears));
  }

  if (req.body.nextIncrementDate !== undefined) {
    updates.nextIncrementDate = startOfMonth(req.body.nextIncrementDate);
  } else if (req.body.startDate !== undefined || req.body.incrementFrequencyMonths !== undefined) {
    updates.nextIncrementDate = startOfMonth(addMonths(nextStartDate, nextFrequency));
  }

  const updated = await Contract.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('tenant', 'name email')
    .populate('adminOwner', 'name email');

  res.json(updated);
});
router.post('/:id/increments/preview', requireRole('admin'), async (req, res) => {
  const contract = await Contract.findById(req.params.id);
  if (!contract) return res.status(404).json({ message: 'Contrato no encontrado' });

  const preview = await buildIncrementPreview(contract);
  res.json(preview);
});

router.post('/:id/increments/confirm', requireRole('admin'), async (req, res) => {
  const contract = await Contract.findById(req.params.id);
  if (!contract) return res.status(404).json({ message: 'Contrato no encontrado' });

  const preview = await buildIncrementPreview(contract);

  contract.incrementHistory.push({
    effectiveDate: preview.effectiveDate,
    percent: preview.percent,
    source: preview.source,
    oldAmount: preview.oldAmount,
    newAmount: preview.newAmount,
    confirmedAt: new Date()
  });

  contract.currentAmountUsd = preview.newAmount;
  contract.nextIncrementDate = startOfMonth(addMonths(contract.nextIncrementDate, contract.incrementFrequencyMonths));

  if (preview.source === 'manual_next_amount') {
    contract.manualNextAmountUsd = null;
  }

  if (dayjs(contract.expirationDate).isBefore(dayjs())) {
    contract.status = 'expired';
  }

  await contract.save();
  res.json({ message: 'Incremento confirmado', contract, event: preview });
});

router.get('/:id/projection', async (req, res) => {
  const contract = await Contract.findById(req.params.id);
  const access = assertContractAccess(contract, req.user);
  if (!access.ok) return res.status(access.status).json({ message: access.message });

  const estimated = await getSuggestedIncrement(contract);
  const points = buildProjectionFromHistoryWithEstimates(contract, estimated.percent);

  res.json({
    contractId: contract._id,
    indexType: contract.indexType,
    source: 'history_plus_estimate',
    estimatedPercent: estimated.percent,
    hasManualNextAmount: contract.manualNextAmountUsd !== null && contract.manualNextAmountUsd !== undefined,
    manualNextAmountUsd: contract.manualNextAmountUsd,
    points
  });
});

router.get('/:id/installments', async (req, res) => {
  const contract = await Contract.findById(req.params.id);
  const access = assertContractAccess(contract, req.user);
  if (!access.ok) return res.status(access.status).json({ message: access.message });

  const estimated = await getSuggestedIncrement(contract);
  const points = buildProjectionFromHistoryWithEstimates(contract, estimated.percent);
  const receipts = await Receipt.find({ contract: contract._id }).select('_id year month amountUsd');
  const installments = buildInstallmentsFromProjection(contract, points, receipts);

  res.json({
    contractId: contract._id,
    total: installments.length,
    installments
  });
});

export default router;

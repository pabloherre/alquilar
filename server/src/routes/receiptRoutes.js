import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import dayjs from 'dayjs';
import { Receipt } from '../models/Receipt.js';
import { Contract } from '../models/Contract.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { generateReceiptPdf } from '../services/receiptPdf.js';
import { yearMonthParts } from '../utils/dateMath.js';

const router = Router();
router.use(authRequired);

router.post('/contracts/:contractId/receipts/generate', requireRole('admin'), async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.contractId).populate('tenant', 'name');
    if (!contract) return res.status(404).json({ message: 'Contrato no encontrado' });

    const now = dayjs();
    const { y, m } = yearMonthParts(req.query.year || now.year(), req.query.month || now.month() + 1);

    const receiptNumber = `${contract._id.toString().slice(-6)}-${y}${String(m).padStart(2, '0')}`;
    const existingReceipt = await Receipt.findOne({ contract: contract._id, year: y, month: m });
    const versionSuffix = existingReceipt ? `-${Date.now()}` : '';
    const filename = `receipt-${contract._id}-${y}-${String(m).padStart(2, '0')}${versionSuffix}.pdf`;
    const filePath = path.resolve('server', 'storage', 'receipts', filename);

    await generateReceiptPdf({
      outputPath: filePath,
      receiptNumber,
      tenantName: contract.tenant.name,
      contractTitle: contract.title,
      year: y,
      month: m,
      amountUsd: Number(contract.currentAmountUsd),
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm')
    });

    const previousPath = existingReceipt?.filePath;

    const receipt = await Receipt.findOneAndUpdate(
      { contract: contract._id, year: y, month: m },
      {
        contract: contract._id,
        tenant: contract.tenant._id,
        year: y,
        month: m,
        amountUsd: Number(contract.currentAmountUsd),
        filePath,
        generatedBy: req.user.id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (previousPath && previousPath !== filePath && fs.existsSync(previousPath)) {
      fs.unlink(previousPath, () => {});
    }

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'No se pudo generar el recibo' });
  }
});

router.get('/contracts/:contractId/receipts', async (req, res) => {
  const contract = await Contract.findById(req.params.contractId);
  if (!contract) return res.status(404).json({ message: 'Contrato no encontrado' });

  if (req.user.role !== 'admin' && String(contract.tenant) !== req.user.id) {
    return res.status(403).json({ message: 'Sin permisos' });
  }

  const receipts = await Receipt.find({ contract: contract._id }).sort({ year: -1, month: -1 });
  res.json(receipts);
});

router.get('/receipts/:id/download', async (req, res) => {
  const receipt = await Receipt.findById(req.params.id).populate('contract');
  if (!receipt) return res.status(404).json({ message: 'Recibo no encontrado' });

  const contract = receipt.contract;
  if (req.user.role !== 'admin' && String(contract.tenant) !== req.user.id) {
    return res.status(403).json({ message: 'Sin permisos' });
  }

  if (!fs.existsSync(receipt.filePath)) {
    return res.status(404).json({ message: 'Archivo PDF no encontrado' });
  }

  res.download(receipt.filePath);
});

export default router;

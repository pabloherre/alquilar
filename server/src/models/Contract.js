import mongoose from 'mongoose';

const incrementEventSchema = new mongoose.Schema(
  {
    effectiveDate: { type: Date, required: true },
    percent: { type: Number, required: true },
    source: { type: String, required: true },
    oldAmount: { type: Number, required: true },
    newAmount: { type: Number, required: true },
    confirmedAt: { type: Date, required: true }
  },
  { _id: false }
);

function sanitizeIncrementHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
}

const contractSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    adminOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    expirationDate: { type: Date, required: true },
    incrementFrequencyMonths: { type: Number, enum: [2, 3, 4, 6, 12], required: true },
    durationYears: { type: Number, min: 1, required: true },
    indexType: {
      type: String,
      enum: ['ICL', 'IPC', 'CasaPropia', 'CAC', 'CER', 'IS', 'IPIM', 'UVA', 'OTHER'],
      required: true
    },
    manualOverridePercent: { type: Number, default: 0 },
    manualNextAmountUsd: { type: Number, default: null },
    baseAmountUsd: { type: Number, required: true },
    currentAmountUsd: { type: Number, required: true },
    nextIncrementDate: { type: Date, required: true },
    incrementHistory: { type: [incrementEventSchema], default: [] },
    status: { type: String, enum: ['active', 'expired'], default: 'active' }
  },
  { timestamps: true }
);

contractSchema.pre('init', function onInit(doc) {
  doc.incrementHistory = sanitizeIncrementHistory(doc.incrementHistory);
});

contractSchema.pre('validate', function onValidate(next) {
  this.incrementHistory = sanitizeIncrementHistory(this.incrementHistory);
  next();
});

contractSchema.index({ tenant: 1, status: 1 });

export const Contract = mongoose.model('Contract', contractSchema);

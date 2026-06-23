import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema(
  {
    contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    amountUsd: { type: Number, required: true },
    filePath: { type: String, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

receiptSchema.index({ contract: 1, year: 1, month: 1 }, { unique: true });

export const Receipt = mongoose.model('Receipt', receiptSchema);
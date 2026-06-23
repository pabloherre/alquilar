import mongoose from 'mongoose';

const magicLinkSchema = new mongoose.Schema(
  {
    token: { type: String, unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

magicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MagicLink = mongoose.model('MagicLink', magicLinkSchema);
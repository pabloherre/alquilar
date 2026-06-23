import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api', receiptRoutes);
app.use('/receipts', express.static(path.resolve(__dirname, '..', 'storage', 'receipts')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Server running on ${port}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
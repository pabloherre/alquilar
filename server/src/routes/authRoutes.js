import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dayjs from 'dayjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { MagicLink } from '../models/MagicLink.js';
import { Contract } from '../models/Contract.js';
import { signToken, authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword y newPassword son requeridos' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'La nueva contrasena debe tener al menos 6 caracteres' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  if (!user.passwordHash) {
    return res.status(400).json({ message: 'Tu cuenta usa Google para autenticarse. No podés cambiar la contraseña desde aquí.' });
  }

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'La contrasena actual es incorrecta' });

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  res.json({ message: 'Contrasena actualizada correctamente' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

  return res.json({ token: signToken(user), user: { id: user._id, name: user.name, role: user.role, email: user.email } });
});

router.get('/admin/users', authRequired, requireRole('admin'), async (_req, res) => {
  const users = await User.find({ role: 'user' }).select('name email role').sort({ createdAt: -1 });
  res.json(users);
});

router.post('/admin/users', authRequired, requireRole('admin'), async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'name, email, password requeridos' });

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Email ya registrado' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: String(email).toLowerCase(), passwordHash, role: 'user' });

  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

router.post('/magic-link/request', authRequired, requireRole('admin'), async (req, res) => {
  const { userId } = req.body;
  const tenant = await User.findById(userId);
  if (!tenant || tenant.role !== 'user') return res.status(404).json({ message: 'Usuario no encontrado' });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = dayjs().add(24, 'hour').toDate();
  await MagicLink.create({ token, user: tenant._id, expiresAt });

  const link = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/magic/${token}`;
  res.json({ token, link, expiresAt });
});

router.post('/magic-link/login', async (req, res) => {
  const { token } = req.body;
  const entry = await MagicLink.findOne({ token }).populate('user');
  if (!entry || dayjs(entry.expiresAt).isBefore(dayjs())) {
    return res.status(401).json({ message: 'Magic link inválido o vencido' });
  }

  const user = entry.user;
  await MagicLink.deleteOne({ _id: entry._id });

  if (!(await Contract.exists({ tenant: user._id }))) {
    return res.status(403).json({ message: 'El usuario no tiene contratos asignados' });
  }

  res.json({ token: signToken(user), user: { id: user._id, name: user.name, role: user.role, email: user.email } });
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: 'credential requerido' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: 'Token de Google inválido' });
  }

  const { sub: googleId, email, name } = payload;

  // 1. Buscar por googleId
  let user = await User.findOne({ googleId });

  // 2. Si no, buscar por email y vincular
  if (!user) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.googleId = googleId;
      await user.save();
    }
  }

  // 3. Si no existe, crear nuevo usuario
  if (!user) {
    user = await User.create({
      name,
      email: email.toLowerCase(),
      googleId,
      role: 'user',
    });
  }

  return res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, role: user.role, email: user.email },
  });
});

export default router;
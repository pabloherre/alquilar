import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';

async function run() {
  await connectDB();

  const adminEmail = 'admin@alquilar.local';
  const userEmail = 'tenant@alquilar.local';

  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin1234', 10);
    await User.create({ name: 'Admin', email: adminEmail, passwordHash, role: 'admin' });
  }

  const userExists = await User.findOne({ email: userEmail });
  if (!userExists) {
    const passwordHash = await bcrypt.hash('tenant1234', 10);
    await User.create({ name: 'Tenant Demo', email: userEmail, passwordHash, role: 'user' });
  }

  console.log('Seed complete');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
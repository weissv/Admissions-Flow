import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

dotenv.config();

async function run() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@school.ru';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin12345';
  const fullName = process.env.DEFAULT_ADMIN_NAME || 'Администратор';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log(`ℹ Пользователь ${email} уже существует.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [fullName, email, passwordHash, 'admin']
  );

  console.log(`✔ Создан администратор: ${email} / ${password}`);
  await pool.end();
}

run().catch((err) => {
  console.error('✘ Ошибка создания администратора:', err);
  process.exit(1);
});

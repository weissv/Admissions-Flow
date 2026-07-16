import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const seedPath = path.resolve(__dirname, '../../database/seed.sql');

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const seed = fs.readFileSync(seedPath, 'utf-8');

  const client = await pool.connect();
  try {
    console.log('▶ Применение схемы базы данных...');
    await client.query(schema);
    console.log('✔ Схема применена.');

    console.log('▶ Загрузка сид-данных (пункты договора)...');
    await client.query(seed);
    console.log('✔ Сид-данные загружены.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('✘ Ошибка миграции:', err);
  process.exit(1);
});

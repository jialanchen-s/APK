import 'dotenv/config';

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function setupCustomTypes() {
  const connectionString = process.env.SUDA_DATABASE_URL;
  if (!connectionString) {
    console.error('SUDA_DATABASE_URL is not set; define it in .env before running this script.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    const sqlPath = path.join(__dirname, '..', 'server', 'database', 'custom-types.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('Creating custom types...');
    await pool.query(sql);
    console.log('Custom types created successfully');
  } catch (error) {
    console.error('Error creating custom types:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupCustomTypes();

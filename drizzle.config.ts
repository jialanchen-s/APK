import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

const url = process.env.SUDA_DATABASE_URL;
if (!url) {
  throw new Error('SUDA_DATABASE_URL is not set; define it in .env before running drizzle-kit.');
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
});

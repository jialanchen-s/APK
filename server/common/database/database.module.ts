import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@server/database/schema';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.SUDA_DATABASE_URL,
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}

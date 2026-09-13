import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DATABASE } from '@server/common/database/database.module';
import { appSettings } from '@server/database/schema';

type DrizzleDb = ReturnType<typeof import('drizzle-orm/node-postgres').drizzle>;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DrizzleDb) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const rows = await this.db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    if (rows.length === 0) return null;
    return rows[0].value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({ key, value: value as any })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: value as any },
      });
    this.logger.log(`Settings updated: ${key}`);
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(appSettings).where(eq(appSettings.key, key));
  }
}

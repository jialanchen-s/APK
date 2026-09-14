import { Module, Global, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { spawn } from 'child_process';
import { resolve } from 'path';
import * as schema from '@server/database/schema';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';

const logger = new Logger('DatabaseModule');

function tryConnect(connectionString: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Pool({ connectionString });
    probe.connect((err) => {
      probe.end();
      resolve(!err);
    });
  });
}

function waitForConnection(connectionString: string, maxAttempts = 10, intervalMs = 1000): Promise<boolean> {
  let attempt = 0;
  const poll = (): Promise<boolean> =>
    tryConnect(connectionString).then((ok) => {
      if (ok) return true;
      if (++attempt >= maxAttempts) return false;
      return new Promise((r) => setTimeout(r, intervalMs)).then(poll);
    });
  return poll();
}

function startPostgres(pgCtl: string, dataDir: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const logFile = resolve(dataDir, 'pg_ctl_start.log');
    const child = spawn(pgCtl, ['start', '-D', dataDir, '-l', logFile], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    });
    
    child.unref();
    
    const timeout = setTimeout(() => {
      reject(new Error('pg_ctl 启动超时（10秒）'));
    }, 10000);
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0 || code === null) {
        resolvePromise('PostgreSQL 启动命令已执行');
      } else {
        reject(new Error(`pg_ctl 退出码 ${code}`));
      }
    });
  });
}

async function ensurePostgresRunning(connectionString: string) {
  const cwd = process.cwd();
  const pgCtl = process.env.PG_CTL_PATH || resolve(cwd, '..', 'tools', 'pgsql', 'bin', 'pg_ctl.exe');
  const dataDir = process.env.PG_DATA_DIR || resolve(cwd, '..', 'tools', 'pgsql', 'data');

  logger.log('检测 PostgreSQL 连接…');
  if (await tryConnect(connectionString)) {
    logger.log('PostgreSQL 已就绪');
    return;
  }

  logger.warn('PostgreSQL 未运行，尝试自动启动…');
  try {
    const output = await startPostgres(pgCtl, dataDir);
    if (output) logger.log(`pg_ctl: ${output}`);

    const connected = await waitForConnection(connectionString);
    if (!connected) {
      throw new Error('pg_ctl 已执行但数据库仍无法连接');
    }
    logger.log('PostgreSQL 自动启动成功');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`PostgreSQL 自动启动失败: ${msg}`);
    logger.error(`请手动执行: "${pgCtl}" start -D "${dataDir}"`);
    throw new Error(`无法连接数据库且自动启动失败: ${msg}`);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: async () => {
        const connectionString = process.env.SUDA_DATABASE_URL;
        await ensurePostgresRunning(connectionString);
        const pool = new Pool({ connectionString });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}

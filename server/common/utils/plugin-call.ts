import type { LocalCapabilityService } from '@server/common/capability/local-capability.service';

const DEFAULT_PLUGIN_TIMEOUT_MS = 100_000;

export function serializePluginError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    return cause === undefined
      ? `${err.name}: ${err.message}`
      : `${err.name}: ${err.message}; cause=${JSON.stringify(cause)}`;
  }
  return JSON.stringify(err);
}

export function callCapabilityWithTimeout(
  capabilityService: LocalCapabilityService,
  instanceId: string,
  action: string,
  payload: Record<string, unknown>,
  timeoutMs: number = DEFAULT_PLUGIN_TIMEOUT_MS,
): Promise<unknown> {
  const call = capabilityService.load(instanceId).call(action, payload);
  call.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`插件 ${instanceId} 执行超时`)), timeoutMs);
  });
  const race = Promise.race([call, timeoutPromise]);
  race.finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
  return race;
}

export function useAppInfo() {
  return {
    appId: 'local-dev',
    appName: '制造费用智能测算系统',
    env: 'development' as const,
  };
}

export function getEnv() {
  return 'development';
}

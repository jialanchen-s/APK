export const capabilityClient = {
  call: async (instanceId: string, action: string, payload: Record<string, unknown>) => {
    console.warn(`[capabilityClient stub] ${instanceId}.${action} called`);
    return {};
  },
  load: async (instanceId: string) => {
    console.warn(`[capabilityClient stub] load ${instanceId} called`);
    return {
      call: async (action: string, payload: Record<string, unknown>) => {
        console.warn(`[capabilityClient stub] ${instanceId}.${action} called`);
        return {};
      },
      callStream: async (action: string, payload: Record<string, unknown>) => {
        console.warn(`[capabilityClient stub] ${instanceId}.${action} stream called`);
        return { data: [] };
      },
    };
  },
};

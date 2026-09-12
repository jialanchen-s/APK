export function getDataloom() {
  return {
    query: async () => ({ data: [] }),
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => ({}),
    service: {
      query: async () => ({ data: [] }),
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    storage: {
      query: async () => ({ data: [] }),
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    session: {
      query: async () => ({ data: [] }),
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
  };
}

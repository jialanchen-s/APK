import React from 'react';

export interface UserProfile {
  userId: string;
  userName: string;
  user_id?: string;
  name?: string;
  avatar?: string;
}

const DEV_USER: UserProfile = {
  userId: 'dev-user-001',
  userName: '开发者',
  user_id: 'dev-user-001',
  name: '开发者',
  avatar: '',
};

export function useAuth() {
  return {
    isAuthenticated: true,
    user: DEV_USER,
    ability: { can: () => true },
    isLoading: false,
    login: async () => {},
    logout: async () => {},
  };
}

export function useCurrentUserProfile() {
  return DEV_USER;
}

export function Can({ action, subject, children, fallback }: { action: string; subject: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <>{children}</>;
}

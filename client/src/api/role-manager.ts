import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import type {
  ForceRoleDTO,
  CreateRoleRequest,
  UpdateRoleRequest,
  AddMembersRequest,
  RemoveMembersRequest,
  SearchMembersRequest,
  SearchResponse,
} from '@shared/api.interface';

export async function getRoles(): Promise<ForceRoleDTO[]> {
  const res = await axiosForBackend.get('/api/role_manager/roles');
  return res.data;
}

export async function getRole(bizID: string): Promise<ForceRoleDTO> {
  const res = await axiosForBackend.get(`/api/role_manager/roles/${bizID}`);
  return res.data;
}

export async function createRole(data: CreateRoleRequest): Promise<void> {
  await axiosForBackend.post('/api/role_manager/roles', data);
}

export async function updateRole(bizID: string, data: UpdateRoleRequest): Promise<void> {
  await axiosForBackend.put(`/api/role_manager/roles/${bizID}`, data);
}

export async function deleteRole(bizID: string): Promise<void> {
  await axiosForBackend.delete(`/api/role_manager/roles/${bizID}`);
}

export async function listRoleMembers(
  bizID: string,
  params?: { type?: string; page?: number; pageSize?: number },
): Promise<unknown> {
  const res = await axiosForBackend.get(`/api/role_manager/roles/${bizID}/members`, { params });
  return res.data;
}

export async function addRoleMembers(bizID: string, data: AddMembersRequest): Promise<void> {
  await axiosForBackend.post(`/api/role_manager/roles/${bizID}/members`, data);
}

export async function removeRoleMembers(bizID: string, data: RemoveMembersRequest): Promise<void> {
  await axiosForBackend.post(`/api/role_manager/roles/${bizID}/members/batch_remove`, data);
}

export async function clearRoleMembers(bizID: string): Promise<void> {
  await axiosForBackend.delete(`/api/role_manager/roles/${bizID}/members`);
}

export async function searchMembers(data: SearchMembersRequest): Promise<SearchResponse> {
  const res = await axiosForBackend.post('/api/role_manager/search', data);
  return res.data;
}

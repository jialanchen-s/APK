import { axiosForBackend } from '@client/src/common/platform/axios-instance';
import type {
  PermissionPoint,
  RolePermissionMapping,
  BatchUpdateRoleMappingsRequest,
} from '@shared/api.interface';

export async function listPermissions(): Promise<PermissionPoint[]> {
  const res = await axiosForBackend.get('/api/permissions');
  return res.data;
}

export async function listRoleMappings(): Promise<RolePermissionMapping[]> {
  const res = await axiosForBackend.get('/api/permissions/role-mappings');
  return res.data;
}

export async function batchUpdateRoleMappings(data: BatchUpdateRoleMappingsRequest): Promise<void> {
  await axiosForBackend.post('/api/permissions/role-mappings/batch', data);
}

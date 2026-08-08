/**
 * [INPUT]: 用户查询和修改参数
 * [OUTPUT]: Admin 用户 API 响应
 * [POS]: users 功能的函数式 API Client
 */

import { apiClient } from '@/lib/api-client';
import { ADMIN_API } from '@/lib/api-paths';
import { buildUrl } from '@/lib/query-utils';
import type {
  PaginatedResponse,
  UpdateUserRequest,
  UserDetail,
  UserListItem,
  UserQuery,
} from './types';

export async function getUsers(
  query: UserQuery = {},
): Promise<PaginatedResponse<UserListItem>> {
  return apiClient.get<PaginatedResponse<UserListItem>>(
    buildUrl(ADMIN_API.USERS, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      isAdmin: query.isAdmin,
    }),
  );
}

export async function getUser(id: string): Promise<UserDetail> {
  return apiClient.get<UserDetail>(`${ADMIN_API.USERS}/${id}`);
}

export async function updateUser(
  id: string,
  data: UpdateUserRequest,
): Promise<UserListItem> {
  return apiClient.patch<UserListItem>(`${ADMIN_API.USERS}/${id}`, data);
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`${ADMIN_API.USERS}/${id}`);
}

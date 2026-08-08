/**
 * [DEFINES]: Admin 用户列表、详情与修改合同
 * [USED_BY]: users API、Hooks 与页面
 * [POS]: 用户功能的客户端类型事实源
 */

import type { PaginatedResponse, Pagination } from '@/lib/types';

export type { PaginatedResponse, Pagination };

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetail extends UserListItem {
  image: string | null;
  deletedAt: string | null;
}

export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  isAdmin?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  isAdmin?: boolean;
}

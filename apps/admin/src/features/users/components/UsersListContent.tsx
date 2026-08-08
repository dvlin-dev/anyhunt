/**
 * [PROPS]: 用户列表请求状态与操作回调
 * [EMITS]: onToggleAdmin/onDelete/onPageChange
 * [POS]: 用户列表状态分发组件
 */

import { ListEmptyState, ListLoadingRows } from '@/components/list-state';
import type { PaginatedResponse, UserListItem } from '../types';
import { UsersTable } from './UsersTable';

export type UsersContentState = 'loading' | 'empty' | 'ready';

export interface UsersListContentProps {
  state: UsersContentState;
  data: PaginatedResponse<UserListItem> | undefined;
  onToggleAdmin: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
  onPageChange: (page: number) => void;
}

export function UsersListContent({
  state,
  data,
  onToggleAdmin,
  onDelete,
  onPageChange,
}: UsersListContentProps) {
  if (state === 'loading') return <ListLoadingRows />;
  if (state === 'empty') return <ListEmptyState message="No users found" />;
  if (!data) return null;

  return (
    <UsersTable
      items={data.items}
      pagination={data.pagination}
      onToggleAdmin={onToggleAdmin}
      onDelete={onDelete}
      onPageChange={onPageChange}
    />
  );
}

/**
 * [INPUT]: users API 参数
 * [OUTPUT]: TanStack Query 用户查询与变更操作
 * [POS]: users 功能的服务端状态边界
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteUser, getUser, getUsers, updateUser } from './api';
import type { UpdateUserRequest, UserQuery } from './types';

export const userKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (query?: UserQuery) => [...userKeys.lists(), query] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export function useUsers(query: UserQuery = {}) {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: () => getUsers(query),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: id.length > 0,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      updateUser(id, data),
    onSuccess: async (user) => {
      queryClient.setQueryData(userKeys.detail(user.id), user);
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('User updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Update failed'),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: userKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('User deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Delete failed'),
  });
}

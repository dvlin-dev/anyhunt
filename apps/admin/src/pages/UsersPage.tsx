/**
 * [PROPS]: none
 * [EMITS]: 用户搜索、管理员切换与软删除命令
 * [POS]: Admin 用户管理页面
 */

import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from '@anyhunt/ui';
import {
  UserDeleteDialog,
  UsersListContent,
  type UserListItem,
  type UserQuery,
  type UsersContentState,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from '@/features/users';
import { usePagedSearchQuery } from '@/lib/usePagedSearchQuery';

export default function UsersPage() {
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const {
    query,
    searchInput,
    setSearchInput,
    handleSearch,
    handleSearchKeyDown,
    handlePageChange,
  } = usePagedSearchQuery<UserQuery>({ initialQuery: { page: 1, limit: 20 } });
  const users = useUsers(query);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const state: UsersContentState = users.isLoading
    ? 'loading'
    : (users.data?.items.length ?? 0) > 0
      ? 'ready'
      : 'empty';

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage access and account lifecycle." />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>User directory</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                className="w-full sm:w-64"
                placeholder="Search by email or name"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <Button variant="outline" onClick={handleSearch} aria-label="Search users">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UsersListContent
            state={state}
            data={users.data}
            onToggleAdmin={(user) =>
              updateUser.mutate({
                id: user.id,
                data: { isAdmin: !user.isAdmin },
              })
            }
            onDelete={setDeleteTarget}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>

      <UserDeleteDialog
        open={deleteTarget !== null}
        user={deleteTarget}
        isDeleting={deleteUser.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteUser.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}

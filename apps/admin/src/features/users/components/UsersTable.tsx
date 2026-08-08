/**
 * [PROPS]: 用户、分页与行级操作回调
 * [EMITS]: onToggleAdmin/onDelete/onPageChange
 * [POS]: Admin 用户列表表格
 */

import { Ellipsis, Shield, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SimplePagination,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@anyhunt/ui';
import { formatRelativeTime } from '@anyhunt/ui/lib';
import type { Pagination, UserListItem } from '../types';

export interface UsersTableProps {
  items: UserListItem[];
  pagination: Pagination;
  onToggleAdmin: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
  onPageChange: (page: number) => void;
}

export function UsersTable({
  items,
  pagination,
  onToggleAdmin,
  onDelete,
  onPageChange,
}: UsersTableProps) {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <p className="font-medium">{user.name || 'Unnamed user'}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </TableCell>
              <TableCell>
                <Badge variant={user.emailVerified ? 'secondary' : 'outline'}>
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </TableCell>
              <TableCell>
                <Switch
                  aria-label={`Admin access for ${user.email}`}
                  checked={user.isAdmin}
                  onCheckedChange={() => onToggleAdmin(user)}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelativeTime(user.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${user.email}`}>
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onToggleAdmin(user)}>
                      <Shield className="mr-2 h-4 w-4" />
                      {user.isAdmin ? 'Remove admin access' : 'Grant admin access'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(user)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination.totalPages > 1 ? (
        <div className="mt-4 flex justify-center">
          <SimplePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * [PROPS]: 对话框开关、目标用户、删除状态与回调
 * [EMITS]: onOpenChange/onConfirm
 * [POS]: users 删除确认弹窗
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@anyhunt/ui';
import type { UserListItem } from '../types';

export interface UserDeleteDialogProps {
  open: boolean;
  user: UserListItem | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function UserDeleteDialog({
  open,
  user,
  isDeleting,
  onOpenChange,
  onConfirm,
}: UserDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this user?</AlertDialogTitle>
          <AlertDialogDescription>
            This soft-deletes <strong>{user?.email}</strong>. The account can no longer sign in,
            while its data remains available for operations. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

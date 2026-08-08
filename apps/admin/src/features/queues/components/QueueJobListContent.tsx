/**
 * [PROPS]: queueName/status
 * [EMITS]: none
 * [POS]: 单个队列状态下的任务列表内容
 */

import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import { useQueueJobs } from '../hooks';
import type { QueueJob, QueueJobStatus, QueueName } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@anyhunt/ui';

type QueueJobListState = 'loading' | 'error' | 'empty' | 'ready';

function resolveQueueJobListState(params: {
  isLoading: boolean;
  hasError: boolean;
  itemCount: number;
}): QueueJobListState {
  if (params.isLoading) {
    return 'loading';
  }

  if (params.hasError) {
    return 'error';
  }

  if (params.itemCount === 0) {
    return 'empty';
  }

  return 'ready';
}

function QueueJobsTable({
  items,
  showFailedReason,
}: {
  items: QueueJob[];
  showFailedReason: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead>Queued</TableHead>
          {showFailedReason ? <TableHead>Sanitized error</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-mono text-xs">{job.id}</TableCell>
            <TableCell>{job.name}</TableCell>
            <TableCell>{job.attemptsMade} / {job.maxAttempts}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(job.timestamp).toLocaleString()}
            </TableCell>
            {showFailedReason ? (
              <TableCell className="max-w-xs truncate text-xs text-destructive">
                {job.error}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export interface QueueJobListContentProps {
  queueName: QueueName;
  status: QueueJobStatus;
}

export function QueueJobListContent({ queueName, status }: QueueJobListContentProps) {
  const { data, isLoading, isError, error } = useQueueJobs(queueName, { status, limit: 20 });
  const state = resolveQueueJobListState({
    isLoading,
    hasError: isError,
    itemCount: data?.items.length ?? 0,
  });

  switch (state) {
    case 'loading':
      return <ListLoadingRows />;
    case 'error':
      return (
        <ListErrorState
          message={error instanceof Error ? error.message : 'Failed to load queue jobs'}
          messageClassName="text-destructive text-sm"
        />
      );
    case 'empty':
      return <ListEmptyState message="No jobs in this state" className="py-8 text-center" />;
    case 'ready':
      return <QueueJobsTable items={data?.items ?? []} showFailedReason={status === 'failed'} />;
    default:
      return null;
  }
}

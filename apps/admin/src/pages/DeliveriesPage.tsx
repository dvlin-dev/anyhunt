import { useState } from 'react';
import {
  Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, SimplePagination,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import { useAdminDeliveries } from '@/features/deliveries';

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function DeliveriesPage() {
  const [page, setPage] = useState(1);
  const deliveries = useAdminDeliveries(page);
  return <div className="space-y-6">
    <PageHeader title="Deliveries" description="Inspect idempotent Email and Webhook delivery outcomes." />
    <Card><CardHeader><CardTitle>Delivery diagnostics</CardTitle></CardHeader><CardContent>
      {deliveries.isLoading ? <ListLoadingRows /> : deliveries.isError ? <ListErrorState message="Failed to load deliveries" /> : deliveries.data?.items.length === 0 ? <ListEmptyState message="No deliveries found" /> : <>
        <Table><TableHeader><TableRow><TableHead>Delivery</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Last attempt</TableHead><TableHead>Delivered</TableHead></TableRow></TableHeader>
          <TableBody>{deliveries.data?.items.map((delivery) => <TableRow key={delivery.id}>
            <TableCell><div className="font-mono text-xs">{delivery.id}</div><div className="text-xs text-muted-foreground">Run {delivery.runId}</div></TableCell>
            <TableCell>{delivery.channel}</TableCell><TableCell><Badge variant={delivery.status === 'DELIVERED' ? 'success' : delivery.status === 'FAILED' ? 'destructive' : 'warning'}>{delivery.status}</Badge>{delivery.errorCode && <div className="mt-1 text-xs text-destructive">{delivery.errorCode}</div>}</TableCell>
            <TableCell>{delivery.attemptCount}</TableCell><TableCell>{date(delivery.lastAttemptAt)}</TableCell><TableCell>{date(delivery.deliveredAt)}</TableCell>
          </TableRow>)}</TableBody></Table>
        <div className="mt-4"><SimplePagination page={deliveries.data?.page ?? page} totalPages={Math.max(1, Math.ceil((deliveries.data?.total ?? 0) / (deliveries.data?.limit ?? 20)))} onPageChange={setPage} /></div>
      </>}
    </CardContent></Card>
  </div>;
}

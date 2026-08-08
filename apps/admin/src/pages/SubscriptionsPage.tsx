import { useState } from 'react';
import {
  Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, SimplePagination,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import { useAdminSubscriptions } from '@/features/subscriptions';

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const subscriptions = useAdminSubscriptions(page);
  return <div className="space-y-6">
    <PageHeader title="Subscriptions" description="Inspect Topic follows and delivery channel status." />
    <Card><CardHeader><CardTitle>Subscription operations</CardTitle></CardHeader><CardContent>
      {subscriptions.isLoading ? <ListLoadingRows /> : subscriptions.isError ? <ListErrorState message="Failed to load subscriptions" /> : subscriptions.data?.items.length === 0 ? <ListEmptyState message="No subscriptions found" /> : <>
        <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Topic</TableHead><TableHead>Status</TableHead><TableHead>Channels</TableHead><TableHead>Followed</TableHead></TableRow></TableHeader>
          <TableBody>{subscriptions.data?.items.map((subscription) => <TableRow key={subscription.id}>
            <TableCell><div>{subscription.user.email}</div><div className="text-xs text-muted-foreground">{subscription.user.name ?? subscription.user.id}</div></TableCell>
            <TableCell><div className="font-medium">{subscription.topic.title}</div><div className="text-xs text-muted-foreground">/{subscription.topic.slug}</div></TableCell>
            <TableCell><Badge variant={subscription.enabled && !subscription.canceledAt ? 'success' : 'outline'}>{subscription.enabled && !subscription.canceledAt ? 'ACTIVE' : 'CANCELED'}</Badge></TableCell>
            <TableCell><div className="flex flex-wrap gap-1">{subscription.inboxEnabled && <Badge variant="outline">Inbox</Badge>}{subscription.emailEnabled && <Badge variant="outline">Email</Badge>}{subscription.webhookEnabled && <Badge variant="outline">Webhook</Badge>}{!subscription.inboxEnabled && !subscription.emailEnabled && !subscription.webhookEnabled && <span className="text-muted-foreground">None</span>}</div></TableCell>
            <TableCell>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(subscription.subscribedAt))}</TableCell>
          </TableRow>)}</TableBody></Table>
        <div className="mt-4"><SimplePagination page={subscriptions.data?.page ?? page} totalPages={Math.max(1, Math.ceil((subscriptions.data?.total ?? 0) / (subscriptions.data?.limit ?? 20)))} onPageChange={setPage} /></div>
      </>}
    </CardContent></Card>
  </div>;
}

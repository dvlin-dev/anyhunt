import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  SimplePagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import {
  ModerationDialog,
  type AdminTopic,
  type TopicStatus,
  useAdminTopics,
  useSetTopicStatus,
} from '@/features/topics';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export default function TopicsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<{ topic: AdminTopic; status: TopicStatus } | null>(null);
  const topics = useAdminTopics(page, search);
  const updateStatus = useSetTopicStatus();

  return (
    <div className="space-y-6">
      <PageHeader title="Topics" description="Review research health, ownership, schedules and visibility." />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Topic operations</CardTitle>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              <Input
                aria-label="Search Topics"
                placeholder="Search title or slug"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <Button type="submit" variant="outline">Search</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {topics.isLoading ? <ListLoadingRows /> : topics.isError ? (
            <ListErrorState message="Failed to load Topics" />
          ) : topics.data?.items.length === 0 ? <ListEmptyState message="No Topics found" /> : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Topic</TableHead><TableHead>Owner</TableHead><TableHead>State</TableHead>
                  <TableHead>Audience</TableHead><TableHead>Runs</TableHead><TableHead>Managed Skill</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>{topics.data?.items.map((topic) => {
                  const skillHealthy = Boolean(topic.managedSkill?.enabled && topic.managedSkill.currentVersion > 0);
                  return <TableRow key={topic.id}>
                    <TableCell><div className="font-medium">{topic.title}</div><div className="text-xs text-muted-foreground">/{topic.slug}</div></TableCell>
                    <TableCell><div>{topic.owner.email}</div><div className="text-xs text-muted-foreground">{topic.owner.name ?? topic.owner.id}</div></TableCell>
                    <TableCell className="space-x-2"><Badge variant={topic.status === 'ACTIVE' ? 'success' : 'destructive'}>{topic.status}</Badge><Badge variant="outline">{topic.visibility}</Badge></TableCell>
                    <TableCell>{topic._count.subscriptions} subscribed</TableCell>
                    <TableCell><div>{topic._count.runs} total</div><div className="text-xs text-muted-foreground">Last {formatDate(topic.lastRunAt)}<br />Next {formatDate(topic.nextRunAt)}</div></TableCell>
                    <TableCell>{topic.managedSkill ? <><div>{topic.managedSkill.name} v{topic.managedSkill.currentVersion}</div><Badge variant={skillHealthy ? 'success' : 'warning'}>{skillHealthy ? 'Healthy' : 'Needs attention'}</Badge></> : <Badge variant="warning">Missing</Badge>}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant={topic.status === 'ACTIVE' ? 'destructive' : 'outline'} onClick={() => setTarget({ topic, status: topic.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>{topic.status === 'ACTIVE' ? 'Suspend' : 'Restore'}</Button></TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
              <div className="mt-4"><SimplePagination page={topics.data?.page ?? page} totalPages={Math.max(1, Math.ceil((topics.data?.total ?? 0) / (topics.data?.limit ?? 20)))} onPageChange={setPage} /></div>
            </>
          )}
        </CardContent>
      </Card>
      <ModerationDialog
        open={target !== null}
        title={target?.status === 'SUSPENDED' ? 'Suspend Topic' : 'Restore Topic'}
        description="This change is recorded in the admin audit log and takes effect immediately."
        confirmLabel={target?.status === 'SUSPENDED' ? 'Suspend' : 'Restore'}
        pending={updateStatus.isPending}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        onConfirm={(reason) => {
          if (!target) return;
          updateStatus.mutate({ id: target.topic.id, status: target.status, reason }, { onSuccess: () => setTarget(null) });
        }}
      />
    </div>
  );
}

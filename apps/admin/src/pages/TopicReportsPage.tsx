import { useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, SimplePagination,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import {
  ModerationDialog, type AdminTopicReport, type TopicReportStatus,
  useAdminTopicReports, useResolveTopicReport, useSetTopicStatus,
} from '@/features/topics';

type ReportAction =
  | { kind: 'valid' | 'invalid'; report: AdminTopicReport }
  | { kind: 'suspend' | 'restore'; report: AdminTopicReport };

export default function TopicReportsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TopicReportStatus | undefined>('PENDING');
  const [action, setAction] = useState<ReportAction | null>(null);
  const reports = useAdminTopicReports(page, status);
  const resolveReport = useResolveTopicReport();
  const setTopicStatus = useSetTopicStatus();
  const pending = resolveReport.isPending || setTopicStatus.isPending;

  const labels = action?.kind === 'valid'
    ? ['Confirm report', 'Mark this report as valid after reviewing the evidence.', 'Confirm']
    : action?.kind === 'invalid'
      ? ['Reject report', 'Mark this report as invalid after reviewing the evidence.', 'Reject']
      : action?.kind === 'suspend'
        ? ['Suspend Topic', 'Stop future runs and deliveries for this Topic.', 'Suspend']
        : ['Restore Topic', 'Return this Topic to active operation.', 'Restore'];

  return <div className="space-y-6">
    <PageHeader title="Reports" description="Review user reports and moderate Topics with an audit trail." />
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Topic reports</CardTitle>
      <select aria-label="Report status" className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={status ?? ''} onChange={(event) => { setPage(1); setStatus((event.target.value || undefined) as TopicReportStatus | undefined); }}>
        <option value="">All reports</option><option value="PENDING">Pending</option><option value="RESOLVED_VALID">Valid</option><option value="RESOLVED_INVALID">Invalid</option><option value="DISMISSED">Dismissed</option>
      </select></div></CardHeader><CardContent>
      {reports.isLoading ? <ListLoadingRows /> : reports.isError ? <ListErrorState message="Failed to load reports" /> : reports.data?.items.length === 0 ? <ListEmptyState message="No reports found" /> : <>
        <Table><TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Report</TableHead><TableHead>Reporter</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{reports.data?.items.map((report) => <TableRow key={report.id}>
            <TableCell><div className="font-medium">{report.topic.title}</div><div className="text-xs text-muted-foreground">/{report.topic.slug}</div></TableCell>
            <TableCell><div>{report.reason}</div><div className="max-w-md text-xs text-muted-foreground">{report.description ?? 'No description'}</div></TableCell>
            <TableCell>{report.reporter.email}</TableCell><TableCell><Badge variant={report.status === 'PENDING' ? 'warning' : 'outline'}>{report.status}</Badge></TableCell>
            <TableCell><div className="flex justify-end gap-2">{report.status === 'PENDING' && <><Button size="sm" variant="outline" onClick={() => setAction({ kind: 'invalid', report })}>Reject</Button><Button size="sm" onClick={() => setAction({ kind: 'valid', report })}>Confirm</Button></>}<Button size="sm" variant={report.topic.status === 'ACTIVE' ? 'destructive' : 'outline'} onClick={() => setAction({ kind: report.topic.status === 'ACTIVE' ? 'suspend' : 'restore', report })}>{report.topic.status === 'ACTIVE' ? 'Suspend' : 'Restore'}</Button></div></TableCell>
          </TableRow>)}</TableBody></Table>
        <div className="mt-4"><SimplePagination page={reports.data?.page ?? page} totalPages={Math.max(1, Math.ceil((reports.data?.total ?? 0) / (reports.data?.limit ?? 20)))} onPageChange={setPage} /></div>
      </>}
    </CardContent></Card>
    <ModerationDialog open={action !== null} title={labels[0]!} description={labels[1]!} confirmLabel={labels[2]!} pending={pending} onOpenChange={(open) => { if (!open) setAction(null); }} onConfirm={(reason) => {
      if (!action) return;
      if (action.kind === 'valid' || action.kind === 'invalid') {
        resolveReport.mutate({ id: action.report.id, status: action.kind === 'valid' ? 'RESOLVED_VALID' : 'RESOLVED_INVALID', note: reason }, { onSuccess: () => setAction(null) });
      } else {
        setTopicStatus.mutate({ id: action.report.topic.id, status: action.kind === 'suspend' ? 'SUSPENDED' : 'ACTIVE', reason }, { onSuccess: () => setAction(null) });
      }
    }} />
  </div>;
}

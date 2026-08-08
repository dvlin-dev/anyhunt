import { useState } from 'react';
import {
  Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, SimplePagination,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import { runDurationMs, toRunDiagnostics, useAdminRuns } from '@/features/runs';

function formatDuration(value: number | null) {
  if (value === null) return '—';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export default function RunsPage() {
  const [page, setPage] = useState(1);
  const runs = useAdminRuns(page);
  return <div className="space-y-6">
    <PageHeader title="Runs" description="Inspect bounded Agent execution without exposing prompts or Skill content." />
    <Card><CardHeader><CardTitle>Run diagnostics</CardTitle></CardHeader><CardContent>
      {runs.isLoading ? <ListLoadingRows /> : runs.isError ? <ListErrorState message="Failed to load Runs" /> : runs.data?.items.length === 0 ? <ListEmptyState message="No Runs found" /> : <>
        <Table><TableHeader><TableRow><TableHead>Run</TableHead><TableHead>Status</TableHead><TableHead>Model</TableHead><TableHead>Tools</TableHead><TableHead>Usage</TableHead><TableHead>Timing</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
          <TableBody>{runs.data?.items.map((run) => {
            const diagnostics = toRunDiagnostics(run.runtimeStats);
            return <TableRow key={run.id}>
              <TableCell><div className="font-mono text-xs">{run.id}</div><div className="text-xs text-muted-foreground">{run.trigger} · {run.topicId}</div></TableCell>
              <TableCell><Badge variant={run.status === 'FAILED' ? 'destructive' : run.status === 'SUCCEEDED' ? 'success' : run.status === 'RUNNING' ? 'warning' : 'outline'}>{run.status}</Badge>{run.errorCode && <div className="mt-1 text-xs text-destructive">{run.errorCode}</div>}</TableCell>
              <TableCell>{diagnostics.modelId ?? '—'}<div className="text-xs text-muted-foreground">{diagnostics.turns} turns</div></TableCell>
              <TableCell>{diagnostics.tools.length ? <div className="flex max-w-xs flex-wrap gap-1">{diagnostics.tools.map((tool) => <Badge key={tool.name} variant="outline">{tool.name} × {tool.count}</Badge>)}</div> : <span className="text-muted-foreground">{diagnostics.toolCalls} calls</span>}</TableCell>
              <TableCell><div>{diagnostics.inputTokens.toLocaleString()} in / {diagnostics.outputTokens.toLocaleString()} out</div><div className="text-xs text-muted-foreground">${diagnostics.estimatedCostUsd.toFixed(4)} internal estimate</div></TableCell>
              <TableCell><div>{formatDuration(runDurationMs(run.startedAt, run.completedAt))}</div><div className="text-xs text-muted-foreground">{diagnostics.resumed ? 'Resumed once' : 'Not resumed'}<br />Checkpoint/update {new Date(run.updatedAt ?? run.createdAt).toLocaleString()}</div></TableCell>
              <TableCell>{run._count.items} items<br /><span className="text-xs text-muted-foreground">{run._count.deliveries} deliveries</span></TableCell>
            </TableRow>;
          })}</TableBody></Table>
        <div className="mt-4"><SimplePagination page={runs.data?.page ?? page} totalPages={Math.max(1, Math.ceil((runs.data?.total ?? 0) / (runs.data?.limit ?? 20)))} onPageChange={setPage} /></div>
      </>}
    </CardContent></Card>
  </div>;
}

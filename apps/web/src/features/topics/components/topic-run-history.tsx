import { Badge, Card, CardContent, CardHeader, CardTitle } from '@anyhunt/ui';
import { ExternalLink } from 'lucide-react';
import type { TopicRun } from '../../runs/types';

const statusLabel: Record<TopicRun['status'], string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  SUCCEEDED: 'Complete',
  EMPTY: 'No material changes',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
};

export function TopicRunHistory({ topicId, runs }: { topicId: string; runs: TopicRun[] }) {
  return (
    <Card className="hover:shadow-sm">
      <CardHeader><CardTitle>Run history</CardTitle></CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">The first research run is being prepared.</p>
        ) : (
          <ol className="divide-y divide-border-muted">
            {runs.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                <div>
                  <p className="font-medium">{run.trigger === 'INITIAL' ? 'First research run' : 'Research run'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{new Date(run.scheduledAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{statusLabel[run.status]}</Badge>
                  <a href={`/app/topics/${topicId}/runs/${run.id}`} aria-label={`Open ${statusLabel[run.status]} run`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

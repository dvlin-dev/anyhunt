import { Badge, Button, Card, CardContent } from '@anyhunt/ui';
import { ExternalLink, Square } from 'lucide-react';
import type { TopicRun } from '../types';

interface RunViewProps {
  run: TopicRun;
  onCancel?: () => void;
  isCanceling?: boolean;
}

export function RunView({ run, onCancel, isCanceling = false }: RunViewProps) {
  const isActive = ['QUEUED', 'RUNNING'].includes(run.status);
  const isStopping = Boolean(run.cancelRequestedAt) || isCanceling;

  return (
    <article className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="outline">{run.status.toLowerCase()}</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Research run</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {new Date(run.scheduledAt).toLocaleString()}
          </p>
        </div>
        {isActive && onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isStopping}>
            <Square className="mr-2 size-4" /> {isStopping ? 'Stopping…' : 'Stop run'}
          </Button>
        )}
      </header>

      {run.status === 'FAILED' && (
        <div role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          This run could not finish. {run.errorMessage || 'Try another run from the Topic page.'}
        </div>
      )}
      {isActive && (
        <div aria-live="polite" className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium">{isStopping ? 'Stopping research' : 'Research in progress'}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {isStopping
              ? 'Anyhunt is finishing the current operation and will stop safely.'
              : 'Anyhunt is collecting and verifying current evidence. This page updates automatically.'}
          </p>
        </div>
      )}
      {run.narrative && <p className="max-w-3xl text-base leading-7">{run.narrative}</p>}
      {run.emptyReason && (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {run.emptyReason}
        </p>
      )}
      {run.items && run.items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {run.items.map((item) => (
            <Card key={item.canonicalUrlHash} className="hover:shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Why selected: {item.selectionReason}
                </p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline decoration-border underline-offset-4"
                >
                  Open evidence <ExternalLink className="size-3.5" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </article>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { RunView } from '@/features/runs/components/run-view';
import { useCancelRun, useRun } from '@/features/runs/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/topics/$topicId_/runs/$runId')({
  component: RunPage,
});

function RunPage() {
  const { topicId, runId } = Route.useParams();
  const run = useRun(topicId, runId);
  const cancel = useCancelRun(topicId);
  if (run.isLoading) return <PageLoading />;
  if (run.isError || !run.data) return <PageError retry={() => void run.refetch()} />;
  return (
    <div>
      <a
        href={`/app/topics/${topicId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Topic
      </a>
      <div className="mt-6">
        <RunView
          run={run.data}
          onCancel={() => cancel.mutate(runId)}
          isCanceling={cancel.isPending}
        />
      </div>
    </div>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { Container, MarketingPageShell } from '@/components/layout';
import { RunView } from '@/features/runs/components/run-view';
import { usePublicRun } from '@/features/explore/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/topics/$slug_/runs/$runId')({
  component: PublicRunPage,
});

function PublicRunPage() {
  const { slug, runId } = Route.useParams();
  const run = usePublicRun(slug, runId);
  return (
    <MarketingPageShell>
      <Container className="py-10 sm:py-14" size="narrow">
        {run.isLoading ? (
          <PageLoading />
        ) : run.isError || !run.data ? (
          <PageError retry={() => void run.refetch()} />
        ) : (
          <>
            <a
              href={`/topics/${slug}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← {run.data.topic.title}
            </a>
            <div className="mt-6">
              <RunView
                run={{
                  ...run.data.run,
                  status: 'SUCCEEDED',
                  trigger: 'SCHEDULED',
                  scheduledAt: run.data.run.completedAt,
                }}
              />
            </div>
          </>
        )}
      </Container>
    </MarketingPageShell>
  );
}

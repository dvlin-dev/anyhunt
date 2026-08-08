import { createFileRoute } from '@tanstack/react-router';
import { Container, MarketingPageShell } from '@/components/layout';
import { ExploreList } from '@/features/explore/components/explore-list';
import { useExplore } from '@/features/explore/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/explore')({ component: ExplorePage });

function ExplorePage() {
  const explore = useExplore();
  return (
    <MarketingPageShell>
      <Container className="py-12 sm:py-16">
        <header className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Shared research
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Explore Topics</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Follow a useful Topic and share every future research run without duplicating the Agent.
          </p>
        </header>
        <div className="mt-10">
          {explore.isLoading ? (
            <PageLoading />
          ) : explore.isError ? (
            <PageError retry={() => void explore.refetch()} />
          ) : (
            <ExploreList topics={explore.data?.items ?? []} />
          )}
        </div>
      </Container>
    </MarketingPageShell>
  );
}

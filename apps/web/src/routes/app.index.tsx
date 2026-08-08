import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@anyhunt/ui';
import { Plus } from 'lucide-react';
import { TopicList } from '@/features/topics/components/topic-list';
import { useTopics } from '@/features/topics/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/')({ component: TopicsPage });

function TopicsPage() {
  const topics = useTopics();
  if (topics.isLoading) return <PageLoading />;
  if (topics.isError) return <PageError retry={() => void topics.refetch()} />;
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Topics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Each Topic researches once and keeps improving its reusable method.
          </p>
        </div>
        <Button asChild className="hidden sm:inline-flex">
          <a href="/app/topics/new">
            <Plus className="mr-2 size-4" /> New Topic
          </a>
        </Button>
      </header>
      <TopicList topics={topics.data ?? []} />
    </div>
  );
}

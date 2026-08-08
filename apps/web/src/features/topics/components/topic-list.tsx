import { Badge, Button, Card, CardContent } from '@anyhunt/ui';
import { Plus, Radar } from 'lucide-react';
import type { TopicSummary } from '../types';

export function TopicList({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <Radar className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-5 text-lg font-medium">Start with one Topic</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Describe what matters. Anyhunt will research it now and keep following it.
        </p>
        <Button asChild className="mt-6">
          <a href="/app/topics/new">
            <Plus className="mr-2 size-4" /> Create topic
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {topics.map((topic) => (
        <a key={topic.id} href={`/app/topics/${topic.id}`} className="group block">
          <Card className="h-full group-focus-visible:ring-2 group-focus-visible:ring-ring/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">{topic.visibility.toLowerCase()}</Badge>
                <span className="text-xs text-muted-foreground">
                  {topic.enabled ? 'Active' : 'Paused'}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">{topic.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {topic.goal}
              </p>
              <div className="mt-5 flex gap-4 text-xs text-muted-foreground">
                <span>{topic._count?.runs ?? 0} runs</span>
                <span>{topic._count?.subscriptions ?? 1} followers</span>
              </div>
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  );
}

import { Card, CardContent } from '@anyhunt/ui';
import { ArrowUpRight, Compass } from 'lucide-react';
import type { PublicTopicListResponse } from '../types';

export function ExploreList({ topics }: { topics: PublicTopicListResponse['items'] }) {
  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <Compass className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-4 font-medium">No public Topics yet</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <a key={topic.id} href={`/topics/${topic.slug}`} className="group">
          <Card className="h-full group-focus-visible:ring-2 group-focus-visible:ring-ring/30">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold tracking-tight">{topic.title}</h2>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {topic.goal}
              </p>
              <p className="mt-5 text-xs text-muted-foreground">
                {topic._count.subscriptions} followers
              </p>
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  );
}

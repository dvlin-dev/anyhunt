import { Badge, Button, Card, CardContent } from '@anyhunt/ui';
import { Bell, ExternalLink, GitFork, Users } from 'lucide-react';
import type { PublicTopic } from '../types';

interface PublicTopicViewProps {
  topic: PublicTopic;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  onSubscribe: () => Promise<unknown> | void;
  onFork?: () => Promise<unknown> | void;
}

export function PublicTopicView({
  topic,
  isAuthenticated,
  isSubscribed,
  onSubscribe,
  onFork,
}: PublicTopicViewProps) {
  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-border bg-card px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <Badge variant="outline">Public Topic</Badge>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
          {topic.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{topic.goal}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" /> {topic.subscriberCount} followers
          </span>
          {isAuthenticated ? (
            <Button onClick={() => void onSubscribe()} disabled={isSubscribed}>
              <Bell className="mr-2 size-4" />
              {isSubscribed ? 'Following' : 'Follow topic'}
            </Button>
          ) : (
            <Button asChild>
              <a href={`/login?redirect=${encodeURIComponent(`/topics/${topic.slug}`)}`}>
                Sign in to follow
              </a>
            </Button>
          )}
          {isAuthenticated && onFork && (
            <Button variant="outline" onClick={() => void onFork()}>
              <GitFork className="mr-2 size-4" /> Fork privately
            </Button>
          )}
        </div>
      </header>

      {topic.latestRun ? (
        <section aria-labelledby="latest-run-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Latest research
              </p>
              <h2 id="latest-run-heading" className="mt-2 text-2xl font-semibold tracking-tight">
                {new Date(topic.latestRun.completedAt).toLocaleDateString()}
              </h2>
            </div>
            <a
              href={`/topics/${topic.slug}/runs/${topic.latestRun.id}`}
              className="text-sm underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              Open run
            </a>
          </div>
          {topic.latestRun.narrative && (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              {topic.latestRun.narrative}
            </p>
          )}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {topic.latestRun.items.map((item) => (
              <Card key={item.canonicalUrlHash} className="hover:shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline decoration-border underline-offset-4"
                  >
                    Evidence <ExternalLink className="size-3.5" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <h2 className="font-medium">Research is in progress</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The first evidence-backed update will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

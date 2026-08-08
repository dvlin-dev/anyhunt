import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@anyhunt/ui';
import { InboxList } from '@/features/inbox/components/inbox-list';
import { useInbox, useInboxState } from '@/features/inbox/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/inbox')({ component: InboxPage });

function InboxPage() {
  const [savedOnly, setSavedOnly] = useState(false);
  const inbox = useInbox({ page: 1, limit: 40, ...(savedOnly ? { isSaved: true } : {}) });
  const state = useInboxState();
  if (inbox.isLoading) return <PageLoading />;
  if (inbox.isError) return <PageError retry={() => void inbox.refetch()} />;
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Evidence-backed updates from the Topics you follow.
          </p>
        </div>
        <Button variant={savedOnly ? 'default' : 'outline'} onClick={() => setSavedOnly((value) => !value)}>
          {savedOnly ? 'Show all' : 'Saved'}
        </Button>
      </header>
      <InboxList
        items={inbox.data?.items ?? []}
        onStateChange={(canonicalUrlHash, nextState) =>
          state.mutateAsync({ canonicalUrlHash, state: nextState })
        }
      />
    </div>
  );
}

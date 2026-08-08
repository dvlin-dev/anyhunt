import { Button, Card, CardContent } from '@anyhunt/ui';
import { Bookmark, BookmarkCheck, Eye, EyeOff, ExternalLink, ThumbsDown } from 'lucide-react';
import type { InboxItem } from '../types';

interface InboxListProps {
  items: InboxItem[];
  onStateChange: (
    canonicalUrlHash: string,
    state: Partial<InboxItem['state']>,
  ) => Promise<unknown> | void;
}

export function InboxList({ items, onStateChange }: InboxListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
        <h2 className="text-lg font-medium">Your Inbox is quiet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Follow a public Topic or create your own. New research will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card
          key={`${item.id}:${item.canonicalUrlHash}`}
          className={item.state.isRead ? 'bg-card/70 hover:shadow-sm' : 'hover:shadow-sm'}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {item.run.topic.title}
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Why it matters: {item.selectionReason}
                </p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
                  onClick={() => void onStateChange(item.canonicalUrlHash, { isRead: true })}
                >
                  Read source <ExternalLink className="size-3.5" />
                </a>
              </div>
              <div className="flex shrink-0 gap-1" aria-label={`Actions for ${item.title}`}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={item.state.isRead ? 'Mark unread' : 'Mark read'}
                  onClick={() =>
                    void onStateChange(item.canonicalUrlHash, {
                      isRead: !item.state.isRead,
                    })
                  }
                >
                  {item.state.isRead ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={item.state.isSaved ? 'Remove saved item' : 'Save item'}
                  onClick={() =>
                    void onStateChange(item.canonicalUrlHash, {
                      isSaved: !item.state.isSaved,
                    })
                  }
                >
                  {item.state.isSaved ? <BookmarkCheck /> : <Bookmark />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={
                    item.state.isNotInterested ? 'Restore item' : 'Not interested'
                  }
                  onClick={() =>
                    void onStateChange(item.canonicalUrlHash, {
                      isNotInterested: !item.state.isNotInterested,
                    })
                  }
                >
                  <ThumbsDown />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

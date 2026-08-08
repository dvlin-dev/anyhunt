import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionList } from '@/features/subscriptions/components/subscription-list';
import {
  useCancelSubscription,
  useSubscribe,
  useSubscriptionPreferences,
  useSubscriptions,
} from '@/features/subscriptions/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/subscriptions')({ component: SubscriptionsPage });

function SubscriptionsPage() {
  const subscriptions = useSubscriptions();
  const cancel = useCancelSubscription();
  const subscribe = useSubscribe();
  const preferences = useSubscriptionPreferences();
  if (subscriptions.isLoading) return <PageLoading />;
  if (subscriptions.isError) {
    return <PageError retry={() => void subscriptions.refetch()} />;
  }
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Following</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose where each Topic reaches you. Research settings remain shared with the Topic.
        </p>
      </header>
      <SubscriptionList
        subscriptions={subscriptions.data ?? []}
        onCancel={(topicId) => cancel.mutateAsync(topicId)}
        onRestore={(topicId) => subscribe.mutateAsync(topicId)}
        onPreferences={(topicId, nextPreferences) =>
          preferences.mutateAsync({ topicId, preferences: nextPreferences })
        }
      />
    </div>
  );
}

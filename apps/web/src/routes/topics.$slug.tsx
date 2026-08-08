import { createFileRoute } from '@tanstack/react-router';
import { Container, MarketingPageShell } from '@/components/layout';
import { PublicTopicView } from '@/features/explore/components/public-topic-view';
import { usePublicTopic } from '@/features/explore/hooks';
import { useSubscribe, useSubscriptions } from '@/features/subscriptions/hooks';
import { topicsApi } from '@/features/topics/api';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/topics/$slug')({ component: PublicTopicPage });

function PublicTopicPage() {
  const { slug } = Route.useParams();
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const topic = usePublicTopic(slug);
  const subscriptions = useSubscriptions(authenticated);
  const subscribe = useSubscribe();
  const isSubscribed = Boolean(
    topic.data &&
      subscriptions.data?.some(
        (subscription) => subscription.topicId === topic.data.id && subscription.enabled,
      ),
  );
  return (
    <MarketingPageShell>
      <Container className="py-10 sm:py-14">
        {topic.isLoading ? (
          <PageLoading />
        ) : topic.isError || !topic.data ? (
          <PageError retry={() => void topic.refetch()} />
        ) : (
          <PublicTopicView
            topic={topic.data}
            isAuthenticated={authenticated}
            isSubscribed={isSubscribed}
            onSubscribe={() => subscribe.mutateAsync(topic.data.id)}
            onFork={async () => {
              const fork = await topicsApi.fork(topic.data.slug);
              window.location.assign(`/app/topics/${fork.topic.id}`);
            }}
          />
        )}
      </Container>
    </MarketingPageShell>
  );
}

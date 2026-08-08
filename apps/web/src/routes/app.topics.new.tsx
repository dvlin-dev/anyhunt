import { createFileRoute } from '@tanstack/react-router';
import { TopicCreateForm } from '@/features/topics/components/topic-create-form';
import { useCreateTopic } from '@/features/topics/hooks';

export const Route = createFileRoute('/app/topics/new')({ component: NewTopicPage });

function NewTopicPage() {
  const createTopic = useCreateTopic();
  return (
    <div className="mx-auto max-w-2xl">
      <a href="/app" className="text-sm text-muted-foreground hover:text-foreground">
        ← Topics
      </a>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Create a Topic</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Start with the outcome. Anyhunt discovers sources, uses available Tools, and starts the first
        research run immediately.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <TopicCreateForm
          isSubmitting={createTopic.isPending}
          serverError={createTopic.error instanceof Error ? createTopic.error.message : null}
          onSubmit={async (values) => {
            const created = await createTopic.mutateAsync(values);
            window.location.assign(`/app/topics/${created.topic.id}`);
          }}
        />
      </div>
    </div>
  );
}

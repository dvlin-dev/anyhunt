import { createFileRoute } from '@tanstack/react-router';
import { TopicWorkspace } from '@/features/topics/components/topic-workspace';
import { useTopic, useTopicEnabled, useTopicVisibility } from '@/features/topics/hooks';
import { useCancelRun, useRuns, useTriggerRun } from '@/features/runs/hooks';
import { useSkills, useTopicSkill } from '@/features/skills/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/topics/$topicId')({
  component: TopicPage,
});

function TopicPage() {
  const { topicId } = Route.useParams();
  const topic = useTopic(topicId);
  const runs = useRuns(topicId);
  const skills = useSkills();
  const visibility = useTopicVisibility(topicId);
  const enabled = useTopicEnabled(topicId);
  const trigger = useTriggerRun(topicId);
  const cancel = useCancelRun(topicId);
  const topicSkill = useTopicSkill(topicId);

  if (topic.isLoading || runs.isLoading) return <PageLoading />;
  if (topic.isError || runs.isError || !topic.data) {
    return <PageError retry={() => void Promise.all([topic.refetch(), runs.refetch()])} />;
  }
  const isBusy =
    visibility.isPending || enabled.isPending || trigger.isPending || topicSkill.isPending;
  return (
    <TopicWorkspace
      topic={topic.data}
      runs={runs.data ?? []}
      availableSkills={skills.data ?? []}
      isBusy={isBusy}
      onPublish={() => visibility.mutate('PUBLIC')}
      onPause={() => enabled.mutate(!topic.data.enabled)}
      onRunNow={() => trigger.mutate()}
      onCancelRun={(runId) => cancel.mutate(runId)}
      isCanceling={cancel.isPending}
      onAttachSkill={(skillId) => topicSkill.mutate({ skillId, attached: true })}
      onDetachSkill={(skillId) => topicSkill.mutate({ skillId, attached: false })}
    />
  );
}

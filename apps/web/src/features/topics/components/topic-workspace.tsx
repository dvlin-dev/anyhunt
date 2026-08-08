import { Badge, Button } from '@anyhunt/ui';
import { Pause, Play, Radio, Sparkles, Square } from 'lucide-react';
import type { TopicRun } from '../../runs/types';
import type { SkillSummary, TopicSummary } from '../types';
import { TopicRunHistory } from './topic-run-history';
import { TopicSkillsPanel } from './topic-skills-panel';

type WorkspaceTopic = Pick<
  TopicSummary,
  'id' | 'slug' | 'title' | 'goal' | 'visibility' | 'enabled'
> & {
  managedSkill?: SkillSummary | null;
  attachedSkills?: SkillSummary[];
  cron?: string;
  timezone?: string;
  locale?: string;
};

interface TopicWorkspaceProps {
  topic: WorkspaceTopic;
  runs: TopicRun[];
  availableSkills?: SkillSummary[];
  onPublish: () => void;
  onRunNow: () => void;
  onCancelRun?: (runId: string) => void;
  onPause: () => void;
  onAttachSkill?: (skillId: string) => void;
  onDetachSkill?: (skillId: string) => void;
  isBusy?: boolean;
  isCanceling?: boolean;
}

export function TopicWorkspace({
  topic,
  runs,
  availableSkills = [],
  onPublish,
  onRunNow,
  onCancelRun,
  onPause,
  onAttachSkill,
  onDetachSkill,
  isBusy = false,
  isCanceling = false,
}: TopicWorkspaceProps) {
  const activeRun = runs.find((run) => ['QUEUED', 'RUNNING'].includes(run.status));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{topic.visibility.toLowerCase()}</Badge>
            <span className="text-sm text-muted-foreground">
              {topic.enabled ? 'Scheduled' : 'Paused'}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{topic.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{topic.goal}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {topic.visibility !== 'PUBLIC' && (
            <Button variant="outline" onClick={onPublish} disabled={isBusy}>
              <Radio className="mr-2 size-4" /> Publish
            </Button>
          )}
          <Button variant="outline" onClick={onPause} disabled={isBusy}>
            {topic.enabled ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
            {topic.enabled ? 'Pause' : 'Resume'}
          </Button>
          {activeRun && onCancelRun ? (
            <Button
              variant="outline"
              onClick={() => onCancelRun(activeRun.id)}
              disabled={isBusy || isCanceling || Boolean(activeRun.cancelRequestedAt)}
            >
              <Square className="mr-2 size-4" />
              {activeRun.cancelRequestedAt || isCanceling ? 'Stopping…' : 'Stop run'}
            </Button>
          ) : (
            <Button onClick={onRunNow} disabled={isBusy}>
              <Sparkles className="mr-2 size-4" /> Run now
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <TopicRunHistory topicId={topic.id} runs={runs} />
        <TopicSkillsPanel
          managedSkill={topic.managedSkill}
          attachedSkills={topic.attachedSkills}
          availableSkills={availableSkills}
          onAttachSkill={onAttachSkill}
          onDetachSkill={onDetachSkill}
        />
      </div>
    </div>
  );
}

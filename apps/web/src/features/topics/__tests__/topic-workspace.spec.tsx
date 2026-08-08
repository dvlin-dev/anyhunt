import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopicWorkspace } from '../components/topic-workspace';

describe('TopicWorkspace', () => {
  it('shows the first Run, Managed Skill, multiple Attached Skills and publishing', () => {
    const onCancelRun = vi.fn();
    render(
      <TopicWorkspace
        topic={{
          id: 'topic-1',
          slug: 'ai-infrastructure',
          title: 'AI infrastructure',
          goal: 'Track material releases.',
          visibility: 'PRIVATE',
          enabled: true,
          managedSkill: { id: 'managed-1', name: 'ai-infrastructure-research' },
          attachedSkills: [
            { id: 'skill-1', name: 'official-sources' },
            { id: 'skill-2', name: 'release-verification' },
          ],
        }}
        runs={[
          {
            id: 'run-1',
            status: 'RUNNING',
            trigger: 'INITIAL',
            scheduledAt: '2026-08-03T00:00:00.000Z',
          },
        ]}
        onPublish={vi.fn()}
        onRunNow={vi.fn()}
        onCancelRun={onCancelRun}
        onPause={vi.fn()}
      />
    );

    expect(screen.getByText('First research run')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('ai-infrastructure-research')).toBeTruthy();
    expect(screen.getByText('official-sources')).toBeTruthy();
    expect(screen.getByText('release-verification')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run now' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    expect(onCancelRun).toHaveBeenCalledWith('run-1');
  });

  it('shows Run now when no Run is active', () => {
    render(
      <TopicWorkspace
        topic={{
          id: 'topic-1',
          slug: 'ai-infrastructure',
          title: 'AI infrastructure',
          goal: 'Track material releases.',
          visibility: 'PUBLIC',
          enabled: true,
        }}
        runs={[]}
        onPublish={vi.fn()}
        onRunNow={vi.fn()}
        onCancelRun={vi.fn()}
        onPause={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Run now' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull();
  });
});

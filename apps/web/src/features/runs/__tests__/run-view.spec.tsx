import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RunView } from '../components/run-view';

const runningRun = {
  id: 'run-1',
  status: 'RUNNING' as const,
  trigger: 'MANUAL' as const,
  scheduledAt: '2026-08-08T00:00:00.000Z',
};

describe('RunView', () => {
  it('lets the owner stop an active Run', () => {
    const onCancel = vi.fn();
    render(<RunView run={runningRun} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows the persistent stop request without allowing a duplicate', () => {
    render(
      <RunView
        run={{ ...runningRun, cancelRequestedAt: '2026-08-08T00:00:01.000Z' }}
        onCancel={vi.fn()}
      />
    );

    expect((screen.getByRole('button', { name: 'Stopping…' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.getByText('Stopping research')).toBeTruthy();
  });

  it('does not expose owner actions without an owner callback', () => {
    render(<RunView run={runningRun} />);
    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull();
  });
});

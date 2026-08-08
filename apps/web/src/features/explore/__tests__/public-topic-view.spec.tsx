import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PublicTopicView } from '../components/public-topic-view';

describe('PublicTopicView', () => {
  it('lets a second signed-in user follow one shared Topic', async () => {
    const user = userEvent.setup();
    const onSubscribe = vi.fn().mockResolvedValue(undefined);
    render(
      <PublicTopicView
        topic={{
          id: 'topic-1',
          slug: 'ai-infrastructure',
          title: 'AI infrastructure',
          goal: 'Track material releases.',
          subscriberCount: 12,
          latestRun: null,
        }}
        isAuthenticated
        isSubscribed={false}
        onSubscribe={onSubscribe}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Follow topic' }));
    expect(onSubscribe).toHaveBeenCalledOnce();
    expect(screen.getByText('12 followers')).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InboxList } from '../components/inbox-list';

describe('InboxList', () => {
  it('updates read, saved and not-interested state without exposing scores', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn().mockResolvedValue(undefined);
    render(
      <InboxList
        items={[
          {
            id: 'item-1',
            canonicalUrlHash: 'a'.repeat(64),
            title: 'A material release',
            url: 'https://example.com/release',
            summary: 'The release changes the deployment model.',
            selectionReason: 'Primary source with a concrete change.',
            state: { isRead: false, isSaved: false, isNotInterested: false },
            run: { topic: { title: 'AI infrastructure' } },
          },
        ]}
        onStateChange={onStateChange}
      />,
    );

    expect(screen.queryByText(/score/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save item' }));
    expect(onStateChange).toHaveBeenCalledWith('a'.repeat(64), {
      isSaved: true,
    });
  });
});

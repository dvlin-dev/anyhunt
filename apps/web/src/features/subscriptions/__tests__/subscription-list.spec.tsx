import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionList } from '../components/subscription-list';

describe('SubscriptionList', () => {
  it('cancels a follow without showing research configuration', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(
      <SubscriptionList
        subscriptions={[
          {
            id: 'subscription-1',
            topicId: 'topic-1',
            enabled: true,
            inboxEnabled: true,
            emailEnabled: false,
            webhookEnabled: false,
            topic: { slug: 'ai-infrastructure', title: 'AI infrastructure' },
          },
        ]}
        onCancel={onCancel}
      />
    );

    expect(screen.queryByText(/provider|model|research goal/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Unfollow' }));
    expect(onCancel).toHaveBeenCalledWith('topic-1');
  });

  it('keeps the Webhook form open and explains a failed save', async () => {
    const user = userEvent.setup();
    render(
      <SubscriptionList
        subscriptions={[
          {
            id: 'subscription-1',
            topicId: 'topic-1',
            enabled: true,
            inboxEnabled: true,
            emailEnabled: false,
            webhookEnabled: false,
            topic: { slug: 'ai-infrastructure', title: 'AI infrastructure' },
          },
        ]}
        onCancel={vi.fn()}
        onPreferences={vi.fn().mockRejectedValue(new Error('Invalid Webhook'))}
      />
    );

    await user.click(screen.getByRole('switch', { name: 'Webhook' }));
    await user.type(screen.getByLabelText('Webhook URL'), 'http://example.com/webhook');
    await user.type(screen.getByLabelText('Signing secret'), 'valid-signing-secret');
    await user.click(screen.getByRole('button', { name: 'Enable webhook' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Webhook could not be enabled. Check the URL and signing secret.'
    );
    expect(screen.getByLabelText('Webhook URL')).toBeTruthy();
  });
});

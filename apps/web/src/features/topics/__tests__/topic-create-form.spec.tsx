import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TopicCreateForm } from '../components/topic-create-form';

describe('TopicCreateForm', () => {
  it('keeps creation Topic-first and submits a validated schedule', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TopicCreateForm onSubmit={onSubmit} />);

    expect(screen.queryByLabelText(/provider/i)).toBeNull();
    expect(screen.queryByLabelText(/source/i)).toBeNull();
    expect(screen.queryByLabelText(/skill/i)).toBeNull();

    await user.type(screen.getByLabelText('Title'), 'AI infrastructure');
    await user.type(
      screen.getByLabelText('Research goal'),
      'Track material product and research releases.',
    );
    fireEvent.change(screen.getByLabelText('Frequency'), {
      target: { value: 'daily' },
    });
    fireEvent.change(screen.getByLabelText('Timezone'), {
      target: { value: 'Asia/Shanghai' },
    });
    await user.click(screen.getByRole('button', { name: 'Create topic' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'AI infrastructure',
      goal: 'Track material product and research releases.',
      frequency: 'daily',
      timezone: 'Asia/Shanghai',
      locale: 'en',
    });
  });
});

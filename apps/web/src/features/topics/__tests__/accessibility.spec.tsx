import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { TopicCreateForm } from '../components/topic-create-form';

describe('Web accessibility baseline', () => {
  it('moves focus to the first invalid Topic field and exposes the error', async () => {
    const user = userEvent.setup();
    render(<TopicCreateForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Create topic' }));

    const title = screen.getByLabelText('Title');
    expect(document.activeElement).toBe(title);
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a title')).toBeTruthy();
  });

  it('has no automatically detectable critical form violations', async () => {
    const { container } = render(<TopicCreateForm onSubmit={vi.fn()} />);
    const result = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});

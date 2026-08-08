import { useState, type FormEvent } from 'react';
import { Button, Input, Label, Textarea } from '@anyhunt/ui';
import { TopicCreateValuesSchema } from '../schema';
import type { TopicCreateValues } from '../types';

interface TopicCreateFormProps {
  onSubmit: (values: TopicCreateValues) => Promise<unknown>;
  isSubmitting?: boolean;
  serverError?: string | null;
}

export function TopicCreateForm({
  onSubmit,
  isSubmitting = false,
  serverError,
}: TopicCreateFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = TopicCreateValuesSchema.safeParse({
      title: form.get('title'),
      goal: form.get('goal'),
      frequency: form.get('frequency'),
      timezone: form.get('timezone'),
      locale: form.get('locale'),
    });
    if (!result.success) {
      const firstField = String(result.error.issues[0]?.path[0] ?? 'title');
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      const element = event.currentTarget.elements.namedItem(firstField);
      if (element instanceof HTMLElement) element.focus();
      return;
    }
    setErrors({});
    await onSubmit(result.data);
  }

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="topic-title">Title</Label>
        <Input
          id="topic-title"
          name="title"
          autoFocus
          maxLength={200}
          placeholder="AI infrastructure"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'topic-title-error' : undefined}
        />
        {errors.title && (
          <p id="topic-title-error" className="text-sm text-destructive">
            {errors.title}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-goal">Research goal</Label>
        <Textarea
          id="topic-goal"
          name="goal"
          rows={5}
          maxLength={4_000}
          placeholder="Track material product, research, and policy updates. Prefer primary sources."
          aria-invalid={Boolean(errors.goal)}
          aria-describedby={errors.goal ? 'topic-goal-help topic-goal-error' : 'topic-goal-help'}
        />
        <p id="topic-goal-help" className="text-sm text-muted-foreground">
          Describe the signal you want. Anyhunt will discover sources and improve its method.
        </p>
        {errors.goal && (
          <p id="topic-goal-error" className="text-sm text-destructive">
            {errors.goal}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="topic-frequency">Frequency</Label>
          <select
            id="topic-frequency"
            name="frequency"
            defaultValue="daily"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Every week</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic-timezone">Timezone</Label>
          <Input
            id="topic-timezone"
            name="timezone"
            defaultValue={
              typeof Intl === 'undefined'
                ? 'UTC'
                : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic-locale">Language</Label>
          <select
            id="topic-locale"
            name="locale"
            defaultValue="en"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      </div>

      {serverError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating…' : 'Create topic'}
      </Button>
    </form>
  );
}

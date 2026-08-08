import { describe, expect, it } from 'vitest';
import {
  CreateTopicSchema,
  UpdateTopicSchema,
  TopicVisibilityCommandSchema,
} from '../topic.schema';

describe('Topic command schemas', () => {
  it('accepts a minimal production Topic command', () => {
    expect(
      CreateTopicSchema.parse({
        title: 'AI infrastructure',
        goal: 'Track material releases and primary-source announcements.',
        cron: '0 9 * * *',
        timezone: 'Asia/Shanghai',
        locale: 'zh-CN',
      }),
    ).toEqual({
      title: 'AI infrastructure',
      goal: 'Track material releases and primary-source announcements.',
      cron: '0 9 * * *',
      timezone: 'Asia/Shanghai',
      locale: 'zh-CN',
    });
  });

  it.each([
    ['invalid Cron', { cron: 'not a cron' }],
    ['six-field Cron', { cron: '* * * * * *' }],
    ['invalid timezone', { timezone: 'Mars/Olympus' }],
    ['invalid locale', { locale: 'not_a_locale' }],
  ])('rejects %s', (_label, override) => {
    expect(
      CreateTopicSchema.safeParse({
        title: 'AI infrastructure',
        goal: 'Track releases.',
        cron: '0 9 * * *',
        timezone: 'UTC',
        locale: 'en',
        ...override,
      }).success,
    ).toBe(false);
  });

  it('rejects empty updates and unknown visibility values', () => {
    expect(UpdateTopicSchema.safeParse({}).success).toBe(false);
    expect(
      TopicVisibilityCommandSchema.safeParse({ visibility: 'HIDDEN' }).success,
    ).toBe(false);
  });
});

import { z } from 'zod';

export const TopicCreateValuesSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(200),
  goal: z.string().trim().min(10, 'Describe what the Agent should track').max(4_000),
  frequency: z.enum(['daily', 'weekdays', 'weekly']),
  timezone: z.string().trim().min(1),
  locale: z.string().trim().min(2).max(35),
});

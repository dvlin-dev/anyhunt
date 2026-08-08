import { z } from 'zod';

export const TopicReportSchema = z
  .object({
    reason: z.enum([
      'SPAM',
      'COPYRIGHT',
      'INAPPROPRIATE',
      'MISLEADING',
      'OTHER',
    ]),
    description: z.string().trim().min(10).max(2_000).optional(),
  })
  .strict();

export const AdminReportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(['PENDING', 'RESOLVED_VALID', 'RESOLVED_INVALID', 'DISMISSED'])
      .optional(),
  })
  .strict();

export const ResolveTopicReportSchema = z
  .object({
    status: z.enum(['RESOLVED_VALID', 'RESOLVED_INVALID']),
    note: z.string().trim().min(3).max(2_000),
  })
  .strict();

export const ModerateTopicSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    reason: z.string().trim().min(3).max(2_000),
  })
  .strict();

export type TopicReportDto = z.infer<typeof TopicReportSchema>;
export type AdminReportQueryDto = z.infer<typeof AdminReportQuerySchema>;
export type ResolveTopicReportDto = z.infer<typeof ResolveTopicReportSchema>;
export type ModerateTopicDto = z.infer<typeof ModerateTopicSchema>;

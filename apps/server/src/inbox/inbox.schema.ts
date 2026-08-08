import { z } from 'zod';

const QueryBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const InboxQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    topicId: z.string().trim().min(1).max(128).optional(),
    isRead: QueryBoolean.optional(),
    isSaved: QueryBoolean.optional(),
    isNotInterested: QueryBoolean.optional(),
  })
  .strict();

export const UserItemStateSchema = z
  .object({
    isRead: z.boolean().optional(),
    isSaved: z.boolean().optional(),
    isNotInterested: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'State update cannot be empty',
  );

export const CanonicalUrlHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export type InboxQueryDto = z.infer<typeof InboxQuerySchema>;
export type UserItemStateDto = z.infer<typeof UserItemStateSchema>;

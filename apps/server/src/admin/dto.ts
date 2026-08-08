/**
 * [DEFINES]: Admin 用户与队列查询 DTO
 * [USED_BY]: Admin controllers
 * [POS]: Admin API 的 Zod 合同入口
 */

import { z } from 'zod';

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isAdmin: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.isAdmin !== undefined, {
    message: 'At least one field is required',
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const userQuerySchema = paginationQuerySchema.extend({
  isAdmin: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === 'true' ? true : value === 'false' ? false : undefined,
    ),
});

export type UserQuery = z.infer<typeof userQuerySchema>;

export const queueJobsQuerySchema = paginationQuerySchema
  .omit({ search: true })
  .extend({
    status: z
      .enum(['waiting', 'active', 'completed', 'failed', 'delayed'])
      .default('waiting'),
  });

export type QueueJobsQuery = z.infer<typeof queueJobsQuerySchema>;

export const cleanQueueSchema = z
  .object({
    status: z.enum(['completed', 'failed']).default('completed'),
  })
  .strict();

export type CleanQueueDto = z.infer<typeof cleanQueueSchema>;

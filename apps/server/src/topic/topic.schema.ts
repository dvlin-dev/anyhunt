/**
 * [INPUT]: Topic HTTP commands
 * [OUTPUT]: Strict validated Topic DTOs and next-run calculation
 * [POS]: Single validation source for Topic creation and Owner commands
 */

import cronParser from 'cron-parser';
import { z } from 'zod';

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isValidLocale(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

function isValidCron(value: string): boolean {
  if (value.trim().split(/\s+/).length !== 5) return false;
  try {
    cronParser.parseExpression(value, { tz: 'UTC' });
    return true;
  } catch {
    return false;
  }
}

const TitleSchema = z.string().trim().min(1).max(200);
const GoalSchema = z.string().trim().min(1).max(4_000);
const DescriptionSchema = z.string().trim().max(2_000).nullable();
const CronSchema = z
  .string()
  .trim()
  .max(100)
  .refine(isValidCron, 'Invalid Cron');
const TimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isValidTimezone, 'Invalid IANA timezone');
const LocaleSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .refine(isValidLocale, 'Invalid locale');

export const CreateTopicSchema = z
  .object({
    title: TitleSchema,
    goal: GoalSchema,
    cron: CronSchema,
    timezone: TimezoneSchema,
    locale: LocaleSchema,
  })
  .strict();

export const UpdateTopicSchema = z
  .object({
    title: TitleSchema.optional(),
    goal: GoalSchema.optional(),
    description: DescriptionSchema.optional(),
    cron: CronSchema.optional(),
    timezone: TimezoneSchema.optional(),
    locale: LocaleSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Update cannot be empty');

export const TopicVisibilityCommandSchema = z
  .object({
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']),
  })
  .strict();

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const PublicTopicsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type CreateTopicDto = z.infer<typeof CreateTopicSchema>;
export type UpdateTopicDto = z.infer<typeof UpdateTopicSchema>;
export type TopicVisibilityCommandDto = z.infer<
  typeof TopicVisibilityCommandSchema
>;
export type PublicTopicsQueryDto = z.infer<typeof PublicTopicsQuerySchema>;

export function calculateNextRunAt(
  cron: string,
  timezone: string,
  currentDate = new Date(),
): Date {
  return cronParser
    .parseExpression(cron, { tz: timezone, currentDate })
    .next()
    .toDate();
}

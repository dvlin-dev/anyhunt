/**
 * [DEFINES]: Runtime-neutral structured result accepted from submit_digest
 * [USED_BY]: submit_digest Tool and Agent runner
 * [POS]: Final model-output validation before evidence checks and persistence
 */

import { z } from 'zod';

const HttpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'URL must use HTTP or HTTPS');

export const DigestSubmissionItemSchema = z
  .object({
    url: HttpUrlSchema,
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(4_000),
    selectionReason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const DigestSubmissionSchema = z
  .object({
    narrative: z.string().trim().min(1).max(20_000).optional(),
    items: z.array(DigestSubmissionItemSchema).max(50),
    emptyReason: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict()
  .superRefine((submission, context) => {
    if (submission.items.length === 0 && !submission.emptyReason) {
      context.addIssue({
        code: 'custom',
        path: ['emptyReason'],
        message: 'emptyReason is required when no items are submitted',
      });
    }

    if (submission.items.length > 0 && submission.emptyReason) {
      context.addIssue({
        code: 'custom',
        path: ['emptyReason'],
        message: 'emptyReason is only allowed when no items are submitted',
      });
    }
  });

export type DigestSubmission = z.infer<typeof DigestSubmissionSchema>;
export type DigestSubmissionItem = z.infer<typeof DigestSubmissionItemSchema>;

import { z } from 'zod';
import { isConfiguredLocalWebhookSink } from '../common/utils/local-webhook-sink';

function isAllowedWebhookUrl(value: string): boolean {
  const url = new URL(value);
  if (url.protocol === 'https:') return true;

  return isConfiguredLocalWebhookSink(value);
}

export const SubscriptionPreferencesSchema = z
  .object({
    inboxEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    webhookEnabled: z.boolean().optional(),
    webhookUrl: z
      .url()
      .max(2048)
      .refine(isAllowedWebhookUrl, {
        message: 'Webhook URL must use HTTPS',
      })
      .optional(),
    webhookSecret: z.string().min(16).max(512).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Preferences cannot be empty',
  );

export type SubscriptionPreferencesDto = z.infer<
  typeof SubscriptionPreferencesSchema
>;

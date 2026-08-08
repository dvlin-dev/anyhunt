import { useState, type FormEvent } from 'react';
import { Button, Card, CardContent, Input, Label, Switch } from '@anyhunt/ui';
import type { Subscription, SubscriptionPreferences } from '../types';

interface SubscriptionListProps {
  subscriptions: Subscription[];
  onCancel: (topicId: string) => Promise<unknown> | void;
  onRestore?: (topicId: string) => Promise<unknown> | void;
  onPreferences?: (
    topicId: string,
    preferences: SubscriptionPreferences
  ) => Promise<unknown> | void;
}

export function SubscriptionList({
  subscriptions,
  onCancel,
  onRestore,
  onPreferences,
}: SubscriptionListProps) {
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [savingWebhook, setSavingWebhook] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  if (subscriptions.length === 0) {
    return <p className="text-sm text-muted-foreground">You are not following any Topics yet.</p>;
  }

  async function saveWebhook(event: FormEvent<HTMLFormElement>, subscription: Subscription) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSavingWebhook(subscription.id);
    setWebhookError(null);
    try {
      await onPreferences?.(subscription.topicId, {
        webhookEnabled: true,
        webhookUrl: String(data.get('webhookUrl') ?? ''),
        webhookSecret: String(data.get('webhookSecret') ?? ''),
      });
      setEditingWebhook(null);
    } catch {
      setWebhookError('Webhook could not be enabled. Check the URL and signing secret.');
    } finally {
      setSavingWebhook(null);
    }
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((subscription) => (
        <Card key={subscription.id} className="hover:shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <a
                  href={`/topics/${subscription.topic.slug}`}
                  className="font-semibold underline decoration-transparent underline-offset-4 hover:decoration-border"
                >
                  {subscription.topic.title}
                </a>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subscription.enabled ? 'Following' : 'Not following'}
                </p>
              </div>
              {subscription.enabled ? (
                <Button variant="outline" onClick={() => void onCancel(subscription.topicId)}>
                  Unfollow
                </Button>
              ) : (
                onRestore && (
                  <Button onClick={() => void onRestore(subscription.topicId)}>Follow again</Button>
                )
              )}
            </div>

            {subscription.enabled && onPreferences && (
              <div className="mt-5 border-t border-border-muted pt-5">
                <div className="flex flex-wrap gap-x-7 gap-y-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={subscription.inboxEnabled}
                      onCheckedChange={(checked) =>
                        void onPreferences(subscription.topicId, { inboxEnabled: checked })
                      }
                    />
                    Inbox
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={subscription.emailEnabled}
                      onCheckedChange={(checked) =>
                        void onPreferences(subscription.topicId, { emailEnabled: checked })
                      }
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={subscription.webhookEnabled}
                      onCheckedChange={(checked) => {
                        if (checked && !subscription.webhookUrl) {
                          setWebhookError(null);
                          setEditingWebhook(subscription.id);
                        } else {
                          void onPreferences(subscription.topicId, { webhookEnabled: checked });
                        }
                      }}
                    />
                    Webhook
                  </label>
                </div>
                {editingWebhook === subscription.id && (
                  <form
                    className="mt-5 grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-2"
                    onSubmit={(event) => saveWebhook(event, subscription)}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`webhook-url-${subscription.id}`}>Webhook URL</Label>
                      <Input
                        id={`webhook-url-${subscription.id}`}
                        name="webhookUrl"
                        type="url"
                        required
                        placeholder="https://example.com/anyhunt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`webhook-secret-${subscription.id}`}>Signing secret</Label>
                      <Input
                        id={`webhook-secret-${subscription.id}`}
                        name="webhookSecret"
                        type="password"
                        required
                        minLength={16}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="submit" size="sm" disabled={savingWebhook === subscription.id}>
                        {savingWebhook === subscription.id ? 'Enabling…' : 'Enable webhook'}
                      </Button>
                      {webhookError && (
                        <p role="alert" className="mt-2 text-sm text-destructive">
                          {webhookError}
                        </p>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

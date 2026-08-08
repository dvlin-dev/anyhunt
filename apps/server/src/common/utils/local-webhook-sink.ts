/**
 * [INPUT]: 待验证 Webhook URL 与本地验收环境变量
 * [OUTPUT]: 是否精确匹配唯一配置的本地 Webhook Sink
 * [POS]: 本地验收例外的单一事实源；未配置时始终关闭
 */

export function isConfiguredLocalWebhookSink(value: string): boolean {
  const configured = process.env.ANYHUNT_LOCAL_WEBHOOK_SINK_URL;
  if (!configured) return false;
  try {
    return new URL(value).href === new URL(configured).href;
  } catch {
    return false;
  }
}

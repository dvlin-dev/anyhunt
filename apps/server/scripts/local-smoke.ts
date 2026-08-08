/**
 * [INPUT]: Compose 内部 PostgreSQL、Redis、SearXNG、Mailpit、Webhook Sink 与 Web 地址
 * [OUTPUT]: 六类真实本地依赖与真实 Provider/Agent 闭环的脱敏通过/失败结果
 * [POS]: Docker 本地验收的一次性完整 Smoke；不提供生产测试端点
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma-main/client';
import { EmailService } from '../src/email/email.service';
import { SearchService } from '../src/search/search.service';
import type { ScraperService } from '../src/scraper/scraper.service';
import { runRealProviderSmoke } from './real-provider-smoke';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

async function verifyPostgres(databaseUrl: string): Promise<void> {
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        'CREATE TEMP TABLE local_smoke_probe (value text NOT NULL) ON COMMIT DROP',
      );
      await transaction.$executeRawUnsafe(
        "INSERT INTO local_smoke_probe (value) VALUES ('ok')",
      );
      const rows = await transaction.$queryRawUnsafe<Array<{ value: string }>>(
        'SELECT value FROM local_smoke_probe',
      );
      if (rows.length !== 1 || rows[0]?.value !== 'ok') {
        throw new Error('PostgreSQL write verification failed');
      }
    });
  } finally {
    await database.$disconnect();
  }
}

async function verifyRedisQueue(redisUrl: string): Promise<void> {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<{ probe: string }>('anyhunt-local-smoke', {
    connection,
  });
  try {
    await queue.obliterate({ force: true });
    const job = await queue.add('probe', { probe: 'ok' });
    if (!job.id) throw new Error('Redis queue did not assign a Job ID');
    const stored = await queue.getJob(job.id);
    if (stored?.data.probe !== 'ok') {
      throw new Error('Redis queue verification failed');
    }
    await queue.obliterate({ force: true });
  } finally {
    await queue.close();
    await connection.quit();
  }
}

async function verifySearch(): Promise<void> {
  const search = new SearchService(
    new ConfigService(process.env),
    {} as ScraperService,
  );
  const response = await search.search({
    query: 'OpenAI',
    limit: 1,
    scrapeResults: false,
  });
  if (
    response.query !== 'OpenAI' ||
    !Number.isFinite(response.numberOfResults) ||
    !Array.isArray(response.results)
  ) {
    throw new Error('SearXNG search verification failed');
  }
}

async function verifyBrowser(webUrl: string): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const response = await page.goto(webUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    if (!response?.ok() || !(await page.title()).includes('Anyhunt')) {
      throw new Error('Browser verification failed');
    }
  } finally {
    await browser.close();
  }
}

interface MailpitMessage {
  Subject?: string;
}

interface MailpitMessagesResponse {
  messages?: MailpitMessage[];
}

async function verifyEmail(mailpitUrl: string): Promise<void> {
  const subject = `Anyhunt local smoke ${randomUUID()}`;
  const email = new EmailService(new ConfigService(process.env));
  if (!email.isConfigured())
    throw new Error('Email transport is not configured');

  await email.sendEmail(
    'smoke@anyhunt.local',
    subject,
    '<p>Anyhunt local email smoke</p>',
  );

  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) throw new Error('Mailpit query failed');
  const messages = (await response.json()) as MailpitMessagesResponse;
  if (!messages.messages?.some((message) => message.Subject === subject)) {
    throw new Error('Mailpit email verification failed');
  }
}

interface WebhookSinkRequest {
  headers?: { idempotencyKey?: string | null };
}

interface WebhookSinkResponse {
  requests?: WebhookSinkRequest[];
}

async function verifyWebhook(webhookSinkUrl: string): Promise<void> {
  const deliveryId = randomUUID();
  const accepted = await fetch(`${webhookSinkUrl}/smoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': deliveryId,
      'x-anyhunt-event': 'local.smoke',
    },
    body: JSON.stringify({ status: 'ok' }),
  });
  if (accepted.status !== 202) throw new Error('Webhook Sink delivery failed');

  const response = await fetch(`${webhookSinkUrl}/requests`);
  if (!response.ok) throw new Error('Webhook Sink query failed');
  const payload = (await response.json()) as WebhookSinkResponse;
  if (
    !payload.requests?.some(
      (request) => request.headers?.idempotencyKey === deliveryId,
    )
  ) {
    throw new Error('Webhook Sink verification failed');
  }
}

async function main(): Promise<void> {
  const checks: Array<[string, () => Promise<void>]> = [
    ['PostgreSQL', () => verifyPostgres(required('DATABASE_URL'))],
    ['Redis Queue', () => verifyRedisQueue(required('REDIS_URL'))],
    ['SearXNG Search', verifySearch],
    ['Browser', () => verifyBrowser(process.env.WEB_URL ?? 'http://web:3000')],
    [
      'Mailpit Email',
      () => verifyEmail(process.env.MAILPIT_URL ?? 'http://mailpit:8025'),
    ],
    [
      'Webhook Sink',
      () =>
        verifyWebhook(
          process.env.WEBHOOK_SINK_URL ?? 'http://webhook-sink:3000',
        ),
    ],
  ];

  for (const [name, verify] of checks) {
    await verify();
    process.stdout.write(`${name}: ok\n`);
  }

  const provider = await runRealProviderSmoke();
  process.stdout.write(
    `Real Provider: ok; model=${provider.model}; endpoint=${provider.endpointType}; durationMs=${provider.durationMs}; toolCalls=${provider.toolCalls}\n`,
  );
}

if (require.main === module) {
  void main().catch(() => {
    process.stderr.write('Local dependency smoke failed.\n');
    process.exitCode = 1;
  });
}

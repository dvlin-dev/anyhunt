import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3000';
const MAILPIT_URL = 'http://localhost:8025';
const ADMIN_EMAIL = 'admin@anyhunt.local';
const ADMIN_PASSWORD = 'AnyhuntLocalAdmin1!';

interface TokenBundle {
  accessToken: string;
  user?: { id: string; email: string };
}

interface MailpitMessage {
  ID?: string;
  To?: Array<{ Address?: string }>;
}

interface ResearchFixture {
  topicId: string;
  runId: string;
  title: string;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function testClientIp(): string {
  const bytes = crypto.randomUUID().replaceAll('-', '');
  return `198.19.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}`;
}

function authHeaders(accessToken: string, clientIp: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    origin: 'http://localhost:3001',
    'x-forwarded-for': clientIp,
  };
}

async function verificationCode(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listResponse = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    expect(listResponse.ok()).toBeTruthy();
    const list = (await listResponse.json()) as { messages?: MailpitMessage[] };
    const messageId = list.messages?.find((message) =>
      message.To?.some((recipient) => recipient.Address === email)
    )?.ID;
    if (messageId) {
      const detailResponse = await request.get(
        `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(messageId)}`
      );
      expect(detailResponse.ok()).toBeTruthy();
      const detail = (await detailResponse.json()) as { Text?: string };
      const code = detail.Text?.match(/\b\d{6}\b/)?.[0];
      if (code) return code;
    }
    await delay(250);
  }
  throw new Error('Verification email was not delivered');
}

async function signInOrRegister(
  request: APIRequestContext,
  email: string,
  password: string,
  name: string,
  clientIp: string
): Promise<TokenBundle> {
  const headers = {
    origin: 'http://localhost:3001',
    'x-forwarded-for': clientIp,
  };
  const signIn = await request.post(`${API_URL}/api/v1/auth/sign-in/email`, {
    headers,
    data: { email, password },
  });
  if (signIn.ok()) return (await signIn.json()) as TokenBundle;

  const signUp = await request.post(`${API_URL}/api/v1/auth/sign-up/email`, {
    headers,
    data: { email, password, name },
  });
  expect(signUp.ok()).toBeTruthy();
  const verify = await request.post(`${API_URL}/api/v1/auth/email-otp/verify-email`, {
    headers,
    data: { email, otp: await verificationCode(request, email) },
  });
  expect(verify.ok()).toBeTruthy();
  return (await verify.json()) as TokenBundle;
}

async function createResearchFixture(request: APIRequestContext): Promise<ResearchFixture> {
  const clientIp = testClientIp();
  const email = `admin-e2e-owner-${crypto.randomUUID()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const owner = await signInOrRegister(request, email, password, 'Admin E2E Owner', clientIp);
  const title = `Admin operations ${crypto.randomUUID().slice(0, 8)}`;
  const create = await request.post(`${API_URL}/api/v1/app/topics`, {
    headers: authHeaders(owner.accessToken, clientIp),
    data: {
      title,
      goal: [
        'Find the current Node.js release on the official nodejs.org website.',
        'Use web_search and web_fetch, submit one evidence-backed item, and save reusable experience.',
      ].join(' '),
      cron: '0 9 * * *',
      timezone: 'UTC',
      locale: 'en',
    },
  });
  expect(create.ok()).toBeTruthy();
  const created = (await create.json()) as {
    topic: { id: string };
    initialRun: { id: string };
  };
  const visibility = await request.patch(
    `${API_URL}/api/v1/app/topics/${created.topic.id}/visibility`,
    {
      headers: authHeaders(owner.accessToken, clientIp),
      data: { visibility: 'PUBLIC' },
    }
  );
  expect(visibility.ok()).toBeTruthy();
  const preferences = await request.patch(
    `${API_URL}/api/v1/app/subscriptions/${created.topic.id}/preferences`,
    {
      headers: authHeaders(owner.accessToken, clientIp),
      data: { emailEnabled: true },
    }
  );
  expect(preferences.ok()).toBeTruthy();

  let finalRun: { status: string; items?: unknown[]; runtimeStats?: { tools?: object } } | null = null;
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${API_URL}/api/v1/app/topics/${created.topic.id}/runs/${created.initialRun.id}`,
          { headers: authHeaders(owner.accessToken, clientIp) }
        );
        expect(response.ok()).toBeTruthy();
        finalRun = (await response.json()) as typeof finalRun;
        return finalRun?.status;
      },
      { timeout: 10 * 60_000, intervals: [1_000] }
    )
    .toBe('SUCCEEDED');
  expect(finalRun?.items?.length).toBeGreaterThan(0);
  expect(Object.keys(finalRun?.runtimeStats?.tools ?? {})).toEqual(
    expect.arrayContaining(['web_search', 'web_fetch', 'save_skill'])
  );
  return { topicId: created.topic.id, runId: created.initialRun.id, title };
}

async function adminAccessToken(page: Page): Promise<string> {
  const persisted = await page.evaluate(() => window.localStorage.getItem('ah_admin_auth'));
  const state = persisted
    ? (JSON.parse(persisted) as { state?: { accessToken?: string } }).state
    : undefined;
  if (!state?.accessToken) throw new Error('Admin token-first session was not stored');
  return state.accessToken;
}

test('completes the production operations journey without commercial surfaces', async ({
  page,
  request,
}) => {
  const fixture = await createResearchFixture(request);
  const adminIp = testClientIp();
  await signInOrRegister(
    request,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    'Anyhunt Local Admin',
    adminIp
  );

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': adminIp });
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const accessToken = await adminAccessToken(page);

  const report = await request.post(`${API_URL}/api/v1/app/topics/${fixture.topicId}/report`, {
    headers: authHeaders(accessToken, adminIp),
    data: {
      reason: 'MISLEADING',
      description: 'Admin E2E moderation evidence for the production operations journey.',
    },
  });
  expect(report.ok()).toBeTruthy();

  const navigation = page.getByRole('navigation');
  for (const removedSurface of ['Billing', 'Quota', 'Payment', 'Credits', 'Redemption']) {
    await expect(navigation.getByText(removedSurface, { exact: true })).toHaveCount(0);
  }

  await page.goto('/llm');
  await expect(page.getByRole('heading', { name: 'LLM' })).toBeVisible();
  await expect(page.getByText('Primary OpenAI Provider').first()).toBeVisible();
  await expect(page.getByText('Models', { exact: true }).last()).toBeVisible();

  await page.goto('/topics');
  await page.getByLabel('Search Topics').fill(fixture.title);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const topicRow = page.getByRole('row').filter({ hasText: fixture.title });
  await expect(topicRow).toBeVisible();
  await topicRow.getByRole('button', { name: 'Suspend' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Admin E2E suspension check');
  await page.getByRole('dialog').getByRole('button', { name: 'Suspend' }).click();
  await expect(topicRow.getByText('SUSPENDED')).toBeVisible();
  await topicRow.getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Admin E2E restoration check');
  await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();
  await expect(topicRow.getByText('ACTIVE')).toBeVisible();

  await page.goto('/reports');
  const reportRow = page.getByRole('row').filter({ hasText: fixture.title });
  await expect(reportRow).toBeVisible();
  await reportRow.getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Confirmed during Admin E2E');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await page.getByLabel('Report status').selectOption('RESOLVED_VALID');
  await expect(page.getByRole('row').filter({ hasText: fixture.title })).toContainText(
    'RESOLVED_VALID'
  );

  await page.goto('/runs');
  const runRow = page.getByRole('row').filter({ hasText: fixture.runId });
  await expect(runRow).toContainText('SUCCEEDED');
  await expect(runRow).toContainText('web_search');
  await expect(runRow).toContainText('web_fetch');
  await expect(runRow).toContainText('save_skill');

  await page.goto('/skills');
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
  await expect(page.getByText(/Healthy · v\d+/).first()).toBeVisible();

  await expect
    .poll(
      async () => {
        const response = await request.get(`${API_URL}/api/v1/admin/deliveries?page=1&limit=20`, {
          headers: authHeaders(accessToken, adminIp),
        });
        expect(response.ok()).toBeTruthy();
        const deliveries = (await response.json()) as {
          items?: Array<{ runId: string; channel: string; status: string }>;
        };
        return deliveries.items?.some(
          (delivery) =>
            delivery.runId === fixture.runId &&
            delivery.channel === 'EMAIL' &&
            delivery.status === 'DELIVERED'
        );
      },
      { timeout: 60_000, intervals: [1_000] }
    )
    .toBe(true);
  await page.goto('/deliveries');
  const deliveryRow = page.getByRole('row').filter({ hasText: fixture.runId });
  await expect(deliveryRow).toContainText('EMAIL');
  await expect(deliveryRow).toContainText('DELIVERED');

  await page.goto('/mcp');
  await expect(page.getByRole('heading', { name: 'MCP' })).toBeVisible();
  await expect(page.getByText('No MCP servers are configured')).toBeVisible();

  await page.goto('/queues');
  await expect(page.getByRole('heading', { name: 'Queues' })).toBeVisible();
  await expect(page.getByText('Topic runs', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Email delivery', { exact: true }).last()).toBeVisible();

  await page.goto('/logs/requests');
  await expect(page.getByRole('heading', { name: 'Request Logs' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Route' })).toBeVisible();
  const logBody = page.locator('body');
  await expect(logBody).not.toContainText('Authorization');
  await expect(logBody).not.toContainText('OPENAI_API_KEY');
  await expect(logBody).not.toContainText('Bearer ');
});

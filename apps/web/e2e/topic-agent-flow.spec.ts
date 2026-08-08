import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

const API_URL = 'http://localhost:3000';
const MAILPIT_URL = 'http://localhost:8025';
interface AuthState {
  accessToken: string;
}

interface RunResource {
  id: string;
  status: string;
  trigger: string;
  items?: unknown[];
  runtimeStats?: {
    tools?: Record<string, number>;
  };
  errorCode?: string | null;
}

interface TopicResource {
  id: string;
  slug: string;
  managedSkill?: { id: string } | null;
  attachedSkills?: Array<{ id: string; name: string }>;
}

interface MailpitMessage {
  ID?: string;
  To?: Array<{ Address?: string }>;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function stage(message: string): void {
  console.log(`Web E2E: ${message}`);
}

function testClientIp(): string {
  const bytes = crypto.randomUUID().replaceAll('-', '');
  return `198.18.${Number.parseInt(bytes.slice(0, 2), 16)}.${Number.parseInt(bytes.slice(2, 4), 16)}`;
}

async function verificationCode(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listResponse = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    expect(listResponse.ok()).toBeTruthy();
    const list = (await listResponse.json()) as {
      messages?: MailpitMessage[];
    };
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

async function register(
  page: Page,
  request: APIRequestContext,
  label: string
): Promise<{ email: string; accessToken: string }> {
  const email = `web-e2e-${crypto.randomUUID()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  await page.goto('/register');
  await page.getByLabel('Name (optional)').fill(label);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByLabel('Verification Code')).toBeVisible();
  await page.getByLabel('Verification Code').fill(await verificationCode(request, email));
  await page.getByRole('button', { name: 'Verify Email' }).click();
  await expect(page).toHaveURL('http://localhost:3001/');
  const persisted = await page.evaluate(() => window.localStorage.getItem('ah_auth_session'));
  const state = persisted
    ? (JSON.parse(persisted) as { state?: Partial<AuthState> }).state
    : undefined;
  if (!state?.accessToken) throw new Error('Token-first session was not stored');
  return { email, accessToken: state.accessToken };
}

function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

async function waitForSuccessfulRun(
  page: Page,
  request: APIRequestContext,
  accessToken: string,
  topicId: string,
  runId: string
): Promise<RunResource> {
  await expect(
    page.locator(`a[href="/app/topics/${topicId}/runs/${runId}"][aria-label="Open Complete run"]`)
  ).toBeVisible({ timeout: 10 * 60_000 });
  const response = await request.get(`${API_URL}/api/v1/app/topics/${topicId}/runs/${runId}`, {
    headers: authHeaders(accessToken),
  });
  expect(response.ok()).toBeTruthy();
  const run = (await response.json()) as RunResource;
  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Research Run ended with ${run.status}:${run.errorCode ?? 'NONE'}`);
  }
  expect(run.items?.length).toBeGreaterThan(0);
  return run;
}

function skillZip(name: string, description: string, instruction: string): Buffer {
  const markdown = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    instruction,
    '',
  ].join('\n');
  return Buffer.from(zipSync({ [`${name}/SKILL.md`]: strToU8(markdown) }));
}

async function importAndEnableSkill(
  page: Page,
  name: string,
  description: string,
  instruction: string
): Promise<void> {
  await page.getByLabel('Skill ZIP').setInputFiles({
    name: `${name}.zip`,
    mimeType: 'application/zip',
    buffer: skillZip(name, description, instruction),
  });
  await expect(page.getByRole('link', { name })).toBeVisible();
  await page.getByRole('switch', { name: `Enable ${name}` }).click();
  await expect(page.getByRole('switch', { name: `Disable ${name}` })).toBeVisible();
}

async function triggerRun(page: Page, topicId: string): Promise<string> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url() === `${API_URL}/api/v1/app/topics/${topicId}/runs`
  );
  await page.getByRole('button', { name: 'Run now' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as RunResource).id;
}

async function newUserPage(context: BrowserContext): Promise<Page> {
  return context.newPage();
}

test('completes the production Topic, Skill, publishing, subscription and Inbox journey', async ({
  browser,
  page,
  request,
}) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': testClientIp() });
  const owner = await register(page, request, 'Web E2E Owner');
  await page.goto('/app/topics/new');
  const title = `Node.js release watch ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel('Title').fill(title);
  await page
    .getByLabel('Research goal')
    .fill(
      [
        'Find the current Node.js release on the official nodejs.org website.',
        'Use web_search, then web_fetch an official result, and submit one concise evidence-backed item.',
        'On later runs, activate every attached Skill that applies to official-source or release-date verification.',
      ].join(' ')
    );
  await page.getByLabel('Timezone').fill('UTC');
  await page.getByRole('button', { name: 'Create topic' }).click();
  const initialRunLink = page.getByLabel(/Open (Queued|Running|Complete) run/).first();
  await expect(initialRunLink).toBeVisible();
  const initialRunHref = await initialRunLink.getAttribute('href');
  const initialRunPath = initialRunHref?.split('/');
  const topicId = initialRunPath?.[3];
  const initialRunId = initialRunPath?.[5];
  if (!topicId || !initialRunId) {
    throw new Error('Created Topic and initial Research Run IDs were not available');
  }

  const firstRun = await waitForSuccessfulRun(
    page,
    request,
    owner.accessToken,
    topicId,
    initialRunId
  );
  expect(firstRun.runtimeStats?.tools?.web_search).toBeGreaterThanOrEqual(1);
  expect(firstRun.runtimeStats?.tools?.web_fetch).toBeGreaterThanOrEqual(1);
  expect(firstRun.runtimeStats?.tools?.save_skill).toBeGreaterThanOrEqual(1);
  stage('first research and Managed Skill ok');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await expect(page.getByText('Complete')).toBeVisible();
  const managedSkill = page.locator('a[href^="/app/skills/"]').first();
  await expect(managedSkill).toBeVisible();
  await page.goto(`/app/topics/${topicId}/runs/${initialRunId}`);
  await expect(page.getByRole('link', { name: 'Open evidence' }).first()).toBeVisible();

  await page.goto('/app/skills');
  await importAndEnableSkill(
    page,
    'official-source-check',
    'Use for Node.js release research to verify official nodejs.org evidence.',
    'Activate this Skill and use only official nodejs.org evidence.'
  );
  await importAndEnableSkill(
    page,
    'release-date-check',
    'Use for Node.js release research to verify the release date and current status.',
    'Activate this Skill and verify the date on the fetched official page.'
  );
  stage('two Skills imported and enabled');

  await page.goto(`/app/topics/${topicId}`);
  await page.getByLabel('Attach a Skill').selectOption({ label: 'official-source-check' });
  await expect(page.getByText('official-source-check')).toBeVisible();
  await page.getByLabel('Attach a Skill').selectOption({ label: 'release-date-check' });
  await expect(page.getByText('release-date-check')).toBeVisible();

  const secondRunId = await triggerRun(page, topicId);
  const secondRun = await waitForSuccessfulRun(
    page,
    request,
    owner.accessToken,
    topicId,
    secondRunId
  );
  expect(secondRun.runtimeStats?.tools?.activate_skill).toBeGreaterThanOrEqual(2);
  stage('second research activated both Attached Skills');

  const publishResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url() === `${API_URL}/api/v1/app/topics/${topicId}/visibility`
  );
  await page.getByRole('button', { name: 'Publish' }).click();
  expect((await publishResponse).ok()).toBeTruthy();
  const topicResponse = await request.get(`${API_URL}/api/v1/app/topics/${topicId}`, {
    headers: authHeaders(owner.accessToken),
  });
  expect(topicResponse.ok()).toBeTruthy();
  const topic = (await topicResponse.json()) as TopicResource;
  expect(topic.managedSkill?.id).toBeTruthy();
  expect(topic.attachedSkills).toHaveLength(2);

  const followerContext = await browser.newContext({
    baseURL: 'http://localhost:3001',
    extraHTTPHeaders: { 'x-forwarded-for': testClientIp() },
  });
  const followerPage = await newUserPage(followerContext);
  try {
    await register(followerPage, request, 'Web E2E Follower');
    await followerPage.goto(`/topics/${topic.slug}`);
    await expect(followerPage.getByRole('heading', { name: title })).toBeVisible();
    await followerPage.getByRole('button', { name: 'Follow topic' }).click();
    await expect(followerPage.getByRole('button', { name: 'Following' })).toBeVisible();
    stage('second user followed the public Topic');

    await page.goto(`/app/topics/${topicId}`);
    const sharedRunId = await triggerRun(page, topicId);
    await waitForSuccessfulRun(page, request, owner.accessToken, topicId, sharedRunId);
    stage('post-subscription shared research ok');

    await followerPage.goto('/app/inbox');
    await expect(followerPage.getByRole('heading', { name: 'Inbox' })).toBeVisible();
    await expect(followerPage.getByText(title).first()).toBeVisible();
    await followerPage.getByRole('button', { name: 'Mark read' }).first().click();
    await expect(followerPage.getByRole('button', { name: 'Mark unread' }).first()).toBeVisible();
    await followerPage.getByRole('button', { name: 'Save item' }).first().click();
    await expect(
      followerPage.getByRole('button', { name: 'Remove saved item' }).first()
    ).toBeVisible();
    await followerPage.getByRole('button', { name: 'Not interested' }).first().click();
    await expect(followerPage.getByRole('button', { name: 'Restore item' }).first()).toBeVisible();

    await followerPage.goto('/app/subscriptions');
    await expect(followerPage.getByRole('link', { name: title })).toBeVisible();
    await followerPage.getByRole('button', { name: 'Unfollow' }).click();
    await expect(followerPage.getByText('Not following')).toBeVisible();
    await expect(followerPage.getByRole('button', { name: 'Follow again' })).toBeVisible();
    stage('Inbox states and unfollow ok');
  } finally {
    await followerContext.close();
  }

  await page.goto(`/app/topics/${topicId}`);
  await expect(page.getByRole('button', { name: 'Run now' })).toBeVisible();
  const canceledRunId = await triggerRun(page, topicId);
  const cancelResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url() === `${API_URL}/api/v1/app/topics/${topicId}/runs/${canceledRunId}/cancel`
  );
  await page.getByRole('button', { name: 'Stop run' }).click();
  expect((await cancelResponse).ok()).toBeTruthy();
  await expect(page.getByLabel('Open Canceled run').first()).toBeVisible({ timeout: 60_000 });
  stage('active research stopped from the Topic page');
});

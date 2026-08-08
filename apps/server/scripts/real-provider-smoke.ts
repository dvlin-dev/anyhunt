/**
 * [INPUT]: Compose Server/Mailpit 地址、数据库内已加密的真实 Provider 配置
 * [OUTPUT]: 真实 Pi 协议与 Topic 研究闭环的脱敏 Smoke 摘要
 * [POS]: Docker 一次性真实 Provider 验收；不提供测试端点或认证旁路
 */

import { randomUUID } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { z } from 'zod';
import type { AgentToolDefinition } from '../src/agent/contracts/agent-tool.types';
import {
  PiAgentRuntimeService,
  PiRuntimeError,
} from '../src/agent/runtime/pi-agent-runtime.service';
import {
  PiModelResolverService,
  type ResolvedPiModel,
} from '../src/agent/runtime/pi-model-resolver.service';
import { LlmSecretService } from '../src/llm/llm-secret.service';
import { LlmUpstreamResolverService } from '../src/llm/llm-upstream-resolver.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TERMINAL_RUN_STATUSES = new Set([
  'SUCCEEDED',
  'EMPTY',
  'FAILED',
  'CANCELED',
]);
const RUN_TIMEOUT_MS = 10 * 60_000;
const POLL_INTERVAL_MS = 1_000;

interface AuthBundle {
  accessToken: string;
  user: { id: string };
}

interface MailpitMessage {
  ID?: string;
  To?: Array<{ Address?: string }>;
}

interface TopicRun {
  id: string;
  status: string;
  runtimeStats?: unknown;
  items?: unknown[];
}

interface TopicResource {
  id: string;
  managedSkill?: { id: string } | null;
}

interface TopicCreation {
  topic: TopicResource;
  initialRun: TopicRun;
}

interface SkillImport {
  skill: { id: string };
}

export interface RealProviderSmokeResult {
  model: string;
  endpointType: 'OpenAI-compatible proxy';
  durationMs: number;
  toolCalls: number;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing required setting: ${name}`);
  return normalized;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toolCounts(run: TopicRun): Record<string, number> {
  const tools = record(record(run.runtimeStats)?.tools);
  if (!tools) return {};
  return Object.fromEntries(
    Object.entries(tools).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  );
}

function requireTool(
  tools: Record<string, number>,
  toolName: string,
  minimum = 1,
): void {
  if ((tools[toolName] ?? 0) < minimum) {
    throw new Error(`Required Tool was not exercised: ${toolName}`);
  }
}

function sumTools(tools: Record<string, number>): number {
  return Object.values(tools).reduce((total, count) => total + count, 0);
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(new URL(path, baseUrl), { ...init, headers });
  if (!response.ok) {
    throw new Error(
      `HTTP verification failed: ${init.method ?? 'GET'} ${path}`,
    );
  }
  return (await response.json()) as T;
}

async function registerVerifiedUser(
  serverUrl: string,
  mailpitUrl: string,
): Promise<{ auth: AuthBundle; email: string }> {
  const email = `provider-smoke-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  await requestJson(serverUrl, '/api/v1/auth/sign-up/email', {
    method: 'POST',
    headers: { origin: 'http://localhost:3001' },
    body: JSON.stringify({ name: 'Provider Smoke', email, password }),
  });

  let messageId: string | undefined;
  for (let attempt = 0; attempt < 40 && !messageId; attempt += 1) {
    const response = await requestJson<{ messages?: MailpitMessage[] }>(
      mailpitUrl,
      '/api/v1/messages',
    );
    messageId = response.messages?.find((message) =>
      message.To?.some((recipient) => recipient.Address === email),
    )?.ID;
    if (!messageId) await delay(250);
  }
  if (!messageId) throw new Error('Verification message was not delivered');

  const detail = await requestJson<{ Text?: string }>(
    mailpitUrl,
    `/api/v1/message/${encodeURIComponent(messageId)}`,
  );
  const otp = detail.Text?.match(/\b\d{6}\b/)?.[0];
  if (!otp) throw new Error('Verification code was not available');

  const auth = await requestJson<AuthBundle>(
    serverUrl,
    '/api/v1/auth/email-otp/verify-email',
    {
      method: 'POST',
      headers: { origin: 'http://localhost:3001' },
      body: JSON.stringify({ email, otp }),
    },
  );
  if (!auth.accessToken || !auth.user?.id) {
    throw new Error('Token-first authentication verification failed');
  }
  return { auth, email };
}

async function waitForRun(
  serverUrl: string,
  accessToken: string,
  topicId: string,
  runId: string,
): Promise<TopicRun> {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const run = await requestJson<TopicRun>(
      serverUrl,
      `/api/v1/app/topics/${topicId}/runs/${runId}`,
      {},
      accessToken,
    );
    if (TERMINAL_RUN_STATUSES.has(run.status)) return run;
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error('Topic Run did not reach a terminal state');
}

function assertSuccessfulResearchRun(run: TopicRun): Record<string, number> {
  if (run.status !== 'SUCCEEDED' || !run.items?.length) {
    throw new Error('Real Topic research did not produce a Digest');
  }
  const tools = toolCounts(run);
  requireTool(tools, 'web_search');
  requireTool(tools, 'web_fetch');
  requireTool(tools, 'submit_digest');
  return tools;
}

function skillArchive(
  name: string,
  description: string,
  instruction: string,
): Uint8Array {
  const markdown = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    instruction,
    '',
  ].join('\n');
  return zipSync({ [`${name}/SKILL.md`]: strToU8(markdown) });
}

async function importAndAttachSkill(
  serverUrl: string,
  accessToken: string,
  topicId: string,
  name: string,
  description: string,
  instruction: string,
): Promise<void> {
  const form = new FormData();
  const archive = skillArchive(name, description, instruction);
  const archiveBuffer = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  form.set(
    'file',
    new Blob([archiveBuffer], {
      type: 'application/zip',
    }),
    `${name}.zip`,
  );
  const imported = await requestJson<SkillImport>(
    serverUrl,
    '/api/v1/app/skills/import',
    { method: 'POST', body: form },
    accessToken,
  );
  await requestJson(
    serverUrl,
    `/api/v1/app/skills/${imported.skill.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ enabled: true }) },
    accessToken,
  );
  await requestJson(
    serverUrl,
    `/api/v1/app/skills/${imported.skill.id}/topics/${topicId}`,
    { method: 'POST' },
    accessToken,
  );
}

async function runTopicProductSmoke(
  prisma: PrismaService,
  serverUrl: string,
  mailpitUrl: string,
): Promise<number> {
  process.stdout.write('Real Topic smoke: authentication started\n');
  const { auth, email } = await registerVerifiedUser(serverUrl, mailpitUrl);
  process.stdout.write('Real Topic smoke: authentication ok\n');
  try {
    const creation = await requestJson<TopicCreation>(
      serverUrl,
      '/api/v1/app/topics',
      {
        method: 'POST',
        body: JSON.stringify({
          title: `Node.js release verification ${randomUUID().slice(0, 8)}`,
          goal: [
            'Find the current Node.js release on the official nodejs.org website.',
            'Use web_search, then web_fetch an official result, and submit one concise evidence-backed item.',
            'This recurring research method is reusable, so save it as the Managed Skill.',
            'On later runs, activate every attached Skill that applies to official-source or release-date verification.',
          ].join(' '),
          cron: '0 9 * * *',
          timezone: 'UTC',
          locale: 'en-US',
        }),
      },
      auth.accessToken,
    );

    const firstRun = await waitForRun(
      serverUrl,
      auth.accessToken,
      creation.topic.id,
      creation.initialRun.id,
    );
    const firstTools = assertSuccessfulResearchRun(firstRun);
    requireTool(firstTools, 'save_skill');
    const topic = await requestJson<TopicResource>(
      serverUrl,
      `/api/v1/app/topics/${creation.topic.id}`,
      {},
      auth.accessToken,
    );
    if (!topic.managedSkill?.id) {
      throw new Error('First Topic Run did not create a Managed Skill');
    }
    process.stdout.write(
      'Real Topic smoke: first research and Managed Skill ok\n',
    );

    await importAndAttachSkill(
      serverUrl,
      auth.accessToken,
      creation.topic.id,
      'official-source-check',
      'Use for Node.js release research to verify that evidence is from an official nodejs.org page.',
      'Before finalizing Node.js release research, activate this Skill and use only official nodejs.org evidence.',
    );
    await importAndAttachSkill(
      serverUrl,
      auth.accessToken,
      creation.topic.id,
      'release-date-check',
      'Use for Node.js release research to verify the release date and why the result is current.',
      'Before finalizing Node.js release research, activate this Skill and verify the date on the fetched official page.',
    );

    const secondRun = await requestJson<TopicRun>(
      serverUrl,
      `/api/v1/app/topics/${creation.topic.id}/runs`,
      {
        method: 'POST',
        headers: { 'idempotency-key': `provider-smoke-${randomUUID()}` },
      },
      auth.accessToken,
    );
    const completedSecondRun = await waitForRun(
      serverUrl,
      auth.accessToken,
      creation.topic.id,
      secondRun.id,
    );
    const secondTools = assertSuccessfulResearchRun(completedSecondRun);
    requireTool(secondTools, 'activate_skill', 2);
    process.stdout.write('Real Topic smoke: Attached Skills activation ok\n');

    const canceledRun = await requestJson<TopicRun>(
      serverUrl,
      `/api/v1/app/topics/${creation.topic.id}/runs`,
      {
        method: 'POST',
        headers: { 'idempotency-key': `provider-smoke-cancel-${randomUUID()}` },
      },
      auth.accessToken,
    );
    await requestJson(
      serverUrl,
      `/api/v1/app/topics/${creation.topic.id}/runs/${canceledRun.id}/cancel`,
      { method: 'POST' },
      auth.accessToken,
    );
    const completedCanceledRun = await waitForRun(
      serverUrl,
      auth.accessToken,
      creation.topic.id,
      canceledRun.id,
    );
    if (completedCanceledRun.status !== 'CANCELED') {
      throw new Error('Persisted Topic Run cancellation failed');
    }
    process.stdout.write('Real Topic smoke: persisted cancellation ok\n');

    return sumTools(firstTools) + sumTools(secondTools);
  } finally {
    await prisma.user.deleteMany({ where: { id: auth.user.id } });
    await prisma.verification.deleteMany({ where: { identifier: email } });
  }
}

const PROTOCOL_LIMITS = {
  timeoutMs: 120_000,
  maxTurns: 6,
  maxToolCalls: 6,
  maxInputTokens: 100_000,
  maxOutputTokens: 8_000,
  maxEstimatedCostUsd: 10,
} as const;

async function runPiProtocolSmoke(
  runtime: PiAgentRuntimeService,
  model: ResolvedPiModel,
): Promise<number> {
  process.stdout.write('Pi protocol smoke: stream and Tool Call started\n');
  let probeExecutions = 0;
  const probe: AgentToolDefinition<{ value: 'ok' }, { accepted: true }> = {
    name: 'smoke_probe',
    description:
      'Required protocol probe. Call exactly once with value "ok" before answering.',
    inputSchema: z.object({ value: z.literal('ok') }),
    timeoutMs: 5_000,
    execute: () => {
      probeExecutions += 1;
      return Promise.resolve({ accepted: true });
    },
  };
  const eventTypes = new Set<string>();
  const first = await runtime.run({
    runId: `provider-protocol-${randomUUID()}`,
    systemPrompt:
      'You are a protocol verifier. You must call smoke_probe exactly once, then answer with one short sentence.',
    prompt: 'Run the required protocol probe now.',
    model,
    tools: [probe],
    limits: PROTOCOL_LIMITS,
    onEvent: (event) => {
      eventTypes.add(event.type);
    },
  });
  for (const eventType of [
    'text_delta',
    'tool_call',
    'tool_result',
    'turn_completed',
  ]) {
    if (!eventTypes.has(eventType)) {
      throw new Error(`Pi protocol event was not observed: ${eventType}`);
    }
  }
  if (!first.text.trim() || first.toolCalls !== 1 || probeExecutions !== 1) {
    throw new Error('Pi streaming Tool protocol verification failed');
  }
  process.stdout.write('Pi protocol smoke: stream and Tool Call ok\n');

  const checkpointIndex = first.messages.findIndex((message) => {
    const candidate = record(message);
    return (
      candidate?.role === 'assistant' &&
      Array.isArray(candidate.content) &&
      candidate.content.some((block) => {
        const content = record(block);
        return content?.type === 'toolCall' && content.name === 'smoke_probe';
      })
    );
  });
  if (checkpointIndex < 0) {
    throw new Error('Pi Tool Call checkpoint was not captured');
  }
  let recoveredToolResult = false;
  const recovered = await runtime.run({
    runId: `provider-recovery-${randomUUID()}`,
    systemPrompt:
      'You are a protocol verifier. Continue after the pending Tool Call and answer with one short sentence.',
    prompt: 'Continue from the durable checkpoint.',
    messages: first.messages.slice(0, checkpointIndex + 1),
    model,
    tools: [probe],
    limits: PROTOCOL_LIMITS,
    onState: (state) => {
      if (state.phase === 'tool_result') recoveredToolResult = true;
    },
  });
  if (
    !recoveredToolResult ||
    !recovered.text.trim() ||
    recovered.toolCalls !== 1
  ) {
    throw new Error('Pi durable message checkpoint recovery failed');
  }
  process.stdout.write('Pi protocol smoke: checkpoint recovery ok\n');

  const cancelController = new AbortController();
  let streamedBeforeCancel = false;
  try {
    await runtime.run({
      runId: `provider-cancel-${randomUUID()}`,
      systemPrompt: 'Answer in plain text and begin immediately.',
      prompt: 'Write several short sentences about reliable software.',
      model,
      tools: [],
      limits: PROTOCOL_LIMITS,
      signal: cancelController.signal,
      onEvent: (event) => {
        if (event.type === 'text_delta') {
          streamedBeforeCancel = true;
          cancelController.abort();
        }
      },
    });
    throw new Error('Pi cancellation did not interrupt the provider stream');
  } catch (error) {
    if (!(error instanceof PiRuntimeError) || error.code !== 'ABORTED') {
      throw error;
    }
  }
  if (!streamedBeforeCancel) {
    throw new Error('Pi provider stream did not begin before cancellation');
  }
  process.stdout.write('Pi protocol smoke: streamed cancellation ok\n');

  return first.toolCalls + recovered.toolCalls;
}

export async function runRealProviderSmoke(): Promise<RealProviderSmokeResult> {
  const startedAt = Date.now();
  const serverUrl = required(
    process.env.SERVER_URL ?? 'http://server:3000',
    'SERVER_URL',
  );
  const mailpitUrl = required(
    process.env.MAILPIT_URL ?? 'http://mailpit:8025',
    'MAILPIT_URL',
  );
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const upstreams = new LlmUpstreamResolverService(
      prisma,
      new LlmSecretService(),
    );
    const model = await new PiModelResolverService(upstreams).resolve();
    const protocolToolCalls = await runPiProtocolSmoke(
      new PiAgentRuntimeService(),
      model,
    );
    const productToolCalls = await runTopicProductSmoke(
      prisma,
      serverUrl,
      mailpitUrl,
    );
    return {
      model: model.metadata.upstreamModelId,
      endpointType: 'OpenAI-compatible proxy',
      durationMs: Date.now() - startedAt,
      toolCalls: protocolToolCalls + productToolCalls,
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * [INPUT]: DATABASE_URL、ANYHUNT_LLM_SECRET_KEY 与 OPENAI_* 部署环境变量
 * [OUTPUT]: 幂等写入一个加密 Provider、一个 Model 和默认 LlmSettings
 * [POS]: Docker 本地与生产部署共用的 Provider Seed；Runtime 仍只从数据库解析 Provider
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma-main/client';
import { LlmSecretService } from '../src/llm/llm-secret.service';
import { DEFAULT_LLM_SETTINGS_ID } from '../src/llm/llm.constants';

const LOCAL_PROVIDER_ID = 'local-openai-provider';

const LocalProviderEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'postgres:' || protocol === 'postgresql:';
  }),
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_BASE_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }),
  OPENAI_MODEL: z.string().trim().min(1).max(200),
});

type LocalProviderEnvironment = z.infer<typeof LocalProviderEnvironmentSchema>;

interface SeedTransaction {
  llmProvider: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
  llmModel: {
    deleteMany(args: Record<string, unknown>): Promise<unknown>;
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
  llmSettings: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
  };
}

interface SeedDatabase {
  $transaction<T>(
    callback: (transaction: SeedTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface LocalProviderSeedDependencies {
  database: SeedDatabase;
  encryptApiKey(plaintext: string): string;
}

export interface LocalProviderSeedResult {
  providerId: string;
  modelId: string;
  providerType: 'openai' | 'openai-compatible';
}

function parseEnvironment(raw: NodeJS.ProcessEnv): LocalProviderEnvironment {
  const result = LocalProviderEnvironmentSchema.safeParse(raw);
  if (result.success) return result.data;

  const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))]
    .map(String)
    .sort();
  throw new Error(`Invalid local provider environment: ${names.join(', ')}`);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveProviderType(baseUrl: string): 'openai' | 'openai-compatible' {
  return new URL(baseUrl).hostname.toLowerCase() === 'api.openai.com'
    ? 'openai'
    : 'openai-compatible';
}

export async function seedLocalProvider(
  rawEnvironment: NodeJS.ProcessEnv,
  dependencies: LocalProviderSeedDependencies,
): Promise<LocalProviderSeedResult> {
  const environment = parseEnvironment(rawEnvironment);
  const baseUrl = normalizeBaseUrl(environment.OPENAI_BASE_URL);
  const providerType = resolveProviderType(baseUrl);
  const encryptedApiKey = dependencies.encryptApiKey(
    environment.OPENAI_API_KEY,
  );
  const modelId = environment.OPENAI_MODEL;

  await dependencies.database.$transaction(async (transaction) => {
    await transaction.llmProvider.upsert({
      where: { id: LOCAL_PROVIDER_ID },
      create: {
        id: LOCAL_PROVIDER_ID,
        providerType,
        name: 'Primary OpenAI Provider',
        apiKeyEncrypted: encryptedApiKey,
        baseUrl,
        enabled: true,
        sortOrder: 10_000,
      },
      update: {
        providerType,
        name: 'Primary OpenAI Provider',
        apiKeyEncrypted: encryptedApiKey,
        baseUrl,
        enabled: true,
        sortOrder: 10_000,
      },
    });

    await transaction.llmModel.deleteMany({
      where: { providerId: LOCAL_PROVIDER_ID, modelId: { not: modelId } },
    });
    await transaction.llmModel.upsert({
      where: {
        providerId_modelId: { providerId: LOCAL_PROVIDER_ID, modelId },
      },
      create: {
        providerId: LOCAL_PROVIDER_ID,
        modelId,
        upstreamId: modelId,
        displayName: modelId,
        enabled: true,
        inputTokenPrice: 0,
        outputTokenPrice: 0,
        maxContextTokens: 128_000,
        maxOutputTokens: 32_768,
        capabilitiesJson: {
          vision: false,
          tools: true,
          json: true,
          reasoning: { enabled: true },
        },
        sortOrder: 10_000,
      },
      update: {
        upstreamId: modelId,
        displayName: modelId,
        enabled: true,
        capabilitiesJson: {
          vision: false,
          tools: true,
          json: true,
          reasoning: { enabled: true },
        },
        sortOrder: 10_000,
      },
    });

    await transaction.llmSettings.upsert({
      where: { id: DEFAULT_LLM_SETTINGS_ID },
      create: {
        id: DEFAULT_LLM_SETTINGS_ID,
        defaultAgentModelId: modelId,
      },
      update: { defaultAgentModelId: modelId },
    });
  });

  return { providerId: LOCAL_PROVIDER_ID, modelId, providerType };
}

async function main(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });
  const database = new PrismaClient({ adapter });
  const secrets = new LlmSecretService();

  try {
    await seedLocalProvider(process.env, {
      database: {
        $transaction: (callback) =>
          database.$transaction((transaction) =>
            callback(transaction as unknown as SeedTransaction),
          ),
      },
      encryptApiKey: (plaintext) => secrets.encryptApiKey(plaintext),
    });
    process.stdout.write('Provider seed completed.\n');
  } finally {
    await database.$disconnect();
  }
}

if (require.main === module) {
  void main().catch(() => {
    process.stderr.write('Provider seed failed.\n');
    process.exitCode = 1;
  });
}

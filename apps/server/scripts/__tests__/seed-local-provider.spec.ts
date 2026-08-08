/**
 * [PROVIDES]: Provider Seed 的幂等、加密和失败关闭测试
 * [DEPENDS]: seed-local-provider 纯依赖边界
 * [POS]: 防止部署把明文密钥入库或重复创建 Provider/Model
 */

import { describe, expect, it, vi } from 'vitest';
import {
  seedLocalProvider,
  type LocalProviderSeedDependencies,
} from '../seed-local-provider';

interface UpsertSeedArgs {
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

interface ProviderUpsertSeedArgs extends UpsertSeedArgs {
  create: UpsertSeedArgs['create'] & { id: string };
}

interface ModelUpsertSeedArgs extends UpsertSeedArgs {
  create: UpsertSeedArgs['create'] & { providerId: string; modelId: string };
}

interface ModelDeleteSeedArgs {
  where: { providerId: string; modelId: { not: string } };
}

interface SettingsUpsertSeedArgs extends UpsertSeedArgs {
  create: UpsertSeedArgs['create'] & { id: string };
}

function createEnvironment(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/anyhunt',
    OPENAI_API_KEY: 'provider-secret',
    OPENAI_BASE_URL: 'https://gateway.example.com/v1/',
    OPENAI_MODEL: 'research-model',
    ...overrides,
  };
}

function createDependencies() {
  const providers = new Map<string, Record<string, unknown>>();
  const models = new Map<string, Record<string, unknown>>();
  const settings = new Map<string, Record<string, unknown>>();
  const encryptApiKey = vi.fn(() => 'v1:encrypted');

  const transaction = {
    llmProvider: {
      upsert: vi.fn((args: Record<string, unknown>) => {
        const input = args as unknown as ProviderUpsertSeedArgs;
        providers.set(input.create.id, {
          ...input.create,
          ...input.update,
        });
        return Promise.resolve();
      }),
    },
    llmModel: {
      deleteMany: vi.fn((args: Record<string, unknown>) => {
        const input = args as unknown as ModelDeleteSeedArgs;
        for (const [key, value] of models) {
          if (
            value.providerId === input.where.providerId &&
            value.modelId !== input.where.modelId.not
          ) {
            models.delete(key);
          }
        }
        return Promise.resolve();
      }),
      upsert: vi.fn((args: Record<string, unknown>) => {
        const input = args as unknown as ModelUpsertSeedArgs;
        const key = `${input.create.providerId}:${input.create.modelId}`;
        models.set(key, { ...input.create, ...input.update });
        return Promise.resolve();
      }),
    },
    llmSettings: {
      upsert: vi.fn((args: Record<string, unknown>) => {
        const input = args as unknown as SettingsUpsertSeedArgs;
        settings.set(input.create.id, {
          ...input.create,
          ...input.update,
        });
        return Promise.resolve();
      }),
    },
  };
  const dependencies: LocalProviderSeedDependencies = {
    encryptApiKey,
    database: {
      $transaction: (callback) => callback(transaction),
    },
  };

  return { dependencies, encryptApiKey, providers, models, settings };
}

describe('seedLocalProvider', () => {
  it('encrypts the credential and writes one complete configuration', async () => {
    const state = createDependencies();

    const result = await seedLocalProvider(
      createEnvironment(),
      state.dependencies,
    );

    expect(result).toEqual({
      providerId: 'local-openai-provider',
      modelId: 'research-model',
      providerType: 'openai-compatible',
    });
    expect(state.encryptApiKey).toHaveBeenCalledWith('provider-secret');
    expect(state.providers.size).toBe(1);
    expect(state.models.size).toBe(1);
    expect(state.settings.size).toBe(1);
    expect(JSON.stringify([...state.providers.values()])).not.toContain(
      'provider-secret',
    );
  });

  it('updates the same rows when run repeatedly', async () => {
    const state = createDependencies();

    await seedLocalProvider(createEnvironment(), state.dependencies);
    await seedLocalProvider(createEnvironment(), state.dependencies);

    expect(state.providers.size).toBe(1);
    expect(state.models.size).toBe(1);
    expect(state.settings.size).toBe(1);
  });

  it('replaces the owned model when the configured model changes', async () => {
    const state = createDependencies();

    await seedLocalProvider(createEnvironment(), state.dependencies);
    await seedLocalProvider(
      createEnvironment({ OPENAI_MODEL: 'replacement-model' }),
      state.dependencies,
    );

    expect([...state.models.keys()]).toEqual([
      'local-openai-provider:replacement-model',
    ]);
  });

  it('uses the native OpenAI route only for the official host', async () => {
    const state = createDependencies();

    const result = await seedLocalProvider(
      createEnvironment({ OPENAI_BASE_URL: 'https://api.openai.com/v1' }),
      state.dependencies,
    );

    expect(result.providerType).toBe('openai');
  });

  it('fails with variable names only when required input is missing', async () => {
    const state = createDependencies();

    await expect(
      seedLocalProvider(
        createEnvironment({ OPENAI_API_KEY: undefined }),
        state.dependencies,
      ),
    ).rejects.toThrow('Invalid local provider environment: OPENAI_API_KEY');
  });
});

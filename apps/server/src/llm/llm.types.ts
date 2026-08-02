/**
 * [DEFINES]: LLM module public types (Admin DTOs + runtime resolved route with ModelProvider)
 * [USED_BY]: agent.service.ts, llm-admin.service.ts
 * [POS]: LLM Provider/Model/Settings 的输出类型边界
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */

import type { LlmProviderType } from './dto';
import type { SubscriptionTier } from '../../generated/prisma-main/client';

export type LlmProviderListItem = {
  id: string;
  providerType: LlmProviderType;
  name: string;
  baseUrl: string | null;
  enabled: boolean;
  sortOrder: number;
  apiKeyStatus: 'set';
  createdAt: Date;
  updatedAt: Date;
};

export type LlmModelListItem = {
  id: string;
  providerId: string;
  providerName: string;
  providerType: LlmProviderType;
  modelId: string;
  upstreamId: string;
  displayName: string;
  inputTokenPrice: number;
  outputTokenPrice: number;
  minTier: SubscriptionTier;
  maxContextTokens: number;
  maxOutputTokens: number;
  capabilitiesJson: unknown;
  sortOrder: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type LlmSettingsDto = {
  id: string;
  defaultDigestModelId: string;
  createdAt: Date;
  updatedAt: Date;
};

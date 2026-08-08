/**
 * [INPUT]: Bounded resumable Agent transcript and explicit Run recovery metadata
 * [OUTPUT]: Versioned Prisma JSON checkpoint without hidden reasoning
 * [POS]: The only persistence boundary for in-progress Agent execution
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma-main/client';
import { z } from 'zod';
import { DigestSubmissionSchema } from '../contracts/digest-submission.schema';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_CHECKPOINT_BYTES = 1_048_576;

const BudgetSchema = z
  .object({
    turns: z.number().int().nonnegative(),
    toolCalls: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(),
    cacheWriteTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().finite().nonnegative(),
    elapsedMs: z.number().int().nonnegative(),
  })
  .strict();

const EvidenceSchema = z
  .object({
    normalizedUrl: z.url({ protocol: /^https?$/ }),
    title: z.string().max(500).nullable(),
    retrievedAt: z.iso.datetime(),
    toolName: z.string().min(1).max(256),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const ActivatedSkillVersionSchema = z
  .object({
    skillId: z.string().min(1).max(128),
    versionId: z.string().min(1).max(128),
    version: z.number().int().positive(),
  })
  .strict();

const AgentCheckpointSchema = z
  .object({
    version: z.literal(1),
    messages: z.array(z.unknown()).max(200),
    completedToolCallIds: z.array(z.string().min(1).max(256)).max(500),
    evidence: z.array(EvidenceSchema).max(1_000),
    budget: BudgetSchema,
    activatedSkillVersions: z.array(ActivatedSkillVersionSchema).max(20),
    submitted: z.boolean(),
    submission: DigestSubmissionSchema.optional(),
  })
  .strict()
  .superRefine((checkpoint, context) => {
    if (checkpoint.submitted !== Boolean(checkpoint.submission)) {
      context.addIssue({
        code: 'custom',
        path: ['submitted'],
        message: 'submitted must match submission presence',
      });
    }
  });

export type AgentCheckpointBudget = z.infer<typeof BudgetSchema>;
export type AgentCheckpoint = z.infer<typeof AgentCheckpointSchema>;

function sanitizeMessage(value: unknown): unknown {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Checkpoint contains an invalid Agent message');
  }
  const message = structuredClone(value) as Record<string, unknown>;
  if (typeof message.role !== 'string') {
    throw new Error('Checkpoint contains an invalid Agent message');
  }
  if (Array.isArray(message.content)) {
    message.content = message.content
      .filter((block) => {
        if (!block || Array.isArray(block) || typeof block !== 'object') {
          return false;
        }
        const type = (block as Record<string, unknown>).type;
        return (
          type !== 'thinking' &&
          type !== 'reasoning' &&
          type !== 'redacted_thinking'
        );
      })
      .map((block: unknown) => structuredClone(block));
  }
  if (message.role === 'toolResult') {
    delete message.details;
  }
  delete message._meta;
  return message;
}

function normalizeCheckpoint(value: AgentCheckpoint): AgentCheckpoint {
  const normalized = AgentCheckpointSchema.parse({
    ...value,
    messages: value.messages.map(sanitizeMessage),
    completedToolCallIds: [...new Set(value.completedToolCallIds)],
  });
  if (
    Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_CHECKPOINT_BYTES
  ) {
    throw new Error('Checkpoint exceeds the maximum size');
  }
  return normalized;
}

@Injectable()
export class AgentCheckpointService {
  constructor(private readonly prisma: PrismaService) {}

  async load(runId: string): Promise<AgentCheckpoint | null> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      select: { checkpoint: true },
    });
    if (!run?.checkpoint) return null;
    return normalizeCheckpoint(AgentCheckpointSchema.parse(run.checkpoint));
  }

  async save(runId: string, checkpoint: AgentCheckpoint): Promise<void> {
    const normalized = normalizeCheckpoint(checkpoint);
    await this.prisma.run.update({
      where: { id: runId },
      data: {
        checkpoint: normalized as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  }

  async clear(runId: string): Promise<void> {
    await this.prisma.run.update({
      where: { id: runId },
      data: { checkpoint: Prisma.DbNull },
      select: { id: true },
    });
  }
}

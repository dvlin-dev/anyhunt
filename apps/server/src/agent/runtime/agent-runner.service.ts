/**
 * [INPUT]: One persisted Run, Pi model, fixed Tool permissions, limits, and cancellation
 * [OUTPUT]: Evidence-validated Digest submission plus a durable recovery checkpoint
 * [POS]: Single orchestration layer for one Agent Run; owns no Topic scheduling or Delivery
 */

import { Injectable, Logger } from '@nestjs/common';
import type { AgentRunLimits } from '../contracts/agent-run.types';
import type { DigestSubmission } from '../contracts/digest-submission.schema';
import type { AgentToolPermission } from '../tools/agent-tool-registry.service';
import { AgentToolRegistryService } from '../tools/agent-tool-registry.service';
import { ActivatedSkillStore } from '../tools/activate-skill.tool';
import {
  EvidenceLedgerStore,
  type EvidenceLedgerEntry,
} from '../tools/evidence-ledger';
import { DigestSubmissionStore } from '../tools/submit-digest.tool';
import { PrismaService } from '../../prisma/prisma.service';
import type { ResolvedPiModel } from './pi-model-resolver.service';
import {
  PiAgentRuntimeService,
  PiRuntimeError,
  type PiAgentRunResult,
  type PiRuntimeStateSnapshot,
} from './pi-agent-runtime.service';
import type { PiRuntimeEvent } from './pi-event-adapter';
import {
  AgentCheckpointService,
  type AgentCheckpoint,
  type AgentCheckpointBudget,
} from './agent-checkpoint.service';
import { AgentRunContextStore } from './agent-run-context';
import { EMPTY_AGENT_BUDGET, remainingRunLimits } from './agent-run-budget';

export interface AgentRunnerRequest {
  runId: string;
  topicId: string;
  systemPrompt: string;
  prompt: string;
  model: ResolvedPiModel;
  limits: AgentRunLimits;
  allowedPermissions: ReadonlySet<AgentToolPermission>;
  signal?: AbortSignal;
}

export interface AgentRunnerResult {
  submission: DigestSubmission;
  evidence: readonly EvidenceLedgerEntry[];
  runtime: PiAgentRunResult;
  resumed: boolean;
}

export type AgentRunnerErrorCode =
  'CANCELED' | 'INVALID_RUN' | 'MISSING_SUBMISSION' | 'RESOURCE_LIMIT';

export class AgentRunnerError extends Error {
  constructor(
    readonly code: AgentRunnerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AgentRunnerError';
  }
}

function initialCheckpoint(): AgentCheckpoint {
  return {
    version: 1,
    messages: [],
    completedToolCallIds: [],
    evidence: [],
    budget: { ...EMPTY_AGENT_BUDGET },
    activatedSkillVersions: [],
    submitted: false,
  };
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  constructor(
    private readonly runtime: PiAgentRuntimeService,
    private readonly checkpoints: AgentCheckpointService,
    private readonly tools: AgentToolRegistryService,
    private readonly prisma: PrismaService,
    private readonly runContexts: AgentRunContextStore,
    private readonly evidenceLedgers: EvidenceLedgerStore,
    private readonly submissions: DigestSubmissionStore,
    private readonly activatedSkills: ActivatedSkillStore,
  ) {}

  async run(request: AgentRunnerRequest): Promise<AgentRunnerResult> {
    const runStartedAt = Date.now();
    const persisted = await this.prisma.run.findUnique({
      where: { id: request.runId },
      select: {
        id: true,
        topicId: true,
        status: true,
        startedAt: true,
        cancelRequestedAt: true,
      },
    });
    if (
      !persisted ||
      persisted.topicId !== request.topicId ||
      persisted.status === 'SUCCEEDED' ||
      persisted.status === 'EMPTY' ||
      persisted.status === 'CANCELED'
    ) {
      throw new AgentRunnerError('INVALID_RUN', 'Run cannot be executed');
    }

    const loaded = await this.checkpoints.load(request.runId);
    const checkpoint = loaded ?? initialCheckpoint();
    this.logger.log(
      JSON.stringify({
        event: 'agent_run_started',
        runId: request.runId,
        topicId: request.topicId,
        resumed: Boolean(loaded),
      }),
    );
    const baseBudget = { ...checkpoint.budget };
    const segmentStartedAt = Date.now();
    const completedToolCallIds = new Set(checkpoint.completedToolCallIds);
    let messages = [...checkpoint.messages];
    let segmentTurns = 0;
    let segmentToolCalls = 0;
    let segmentUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      estimatedCostUsd: 0,
    };

    this.runContexts.set({ runId: request.runId, topicId: request.topicId });
    this.evidenceLedgers.initialize(request.runId, checkpoint.evidence);
    this.submissions.initialize(request.runId, checkpoint.submission);
    this.activatedSkills.initialize(
      request.runId,
      checkpoint.activatedSkillVersions,
    );

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    request.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (request.signal?.aborted || persisted.cancelRequestedAt)
      controller.abort();
    let cancellationPollActive = false;
    const pollCancellation = async (): Promise<void> => {
      if (cancellationPollActive || controller.signal.aborted) return;
      cancellationPollActive = true;
      try {
        const state = await this.prisma.run.findUnique({
          where: { id: request.runId },
          select: { cancelRequestedAt: true },
        });
        if (!state || state.cancelRequestedAt) controller.abort();
      } catch {
        // A transient polling failure must not be misreported as a user cancel.
      } finally {
        cancellationPollActive = false;
      }
    };
    const cancellationPoll = setInterval(() => {
      void pollCancellation();
    }, 500);
    cancellationPoll.unref();

    const currentBudget = (): AgentCheckpointBudget => ({
      turns: baseBudget.turns + segmentTurns,
      toolCalls: baseBudget.toolCalls + segmentToolCalls,
      inputTokens: baseBudget.inputTokens + segmentUsage.inputTokens,
      outputTokens: baseBudget.outputTokens + segmentUsage.outputTokens,
      cacheReadTokens:
        baseBudget.cacheReadTokens + segmentUsage.cacheReadTokens,
      cacheWriteTokens:
        baseBudget.cacheWriteTokens + segmentUsage.cacheWriteTokens,
      estimatedCostUsd:
        baseBudget.estimatedCostUsd + segmentUsage.estimatedCostUsd,
      elapsedMs:
        baseBudget.elapsedMs + Math.max(0, Date.now() - segmentStartedAt),
    });

    const saveCheckpoint = async (): Promise<void> => {
      const submission = this.submissions.get(request.runId);
      await this.checkpoints.save(request.runId, {
        version: 1,
        messages,
        completedToolCallIds: [...completedToolCallIds],
        evidence: [...this.evidenceLedgers.get(request.runId).snapshot()],
        budget: currentBudget(),
        activatedSkillVersions: [
          ...this.activatedSkills.snapshot(request.runId),
        ],
        submitted: Boolean(submission),
        submission,
      });
    };

    const onEvent = async (event: PiRuntimeEvent): Promise<void> => {
      if (event.type === 'tool_call') {
        segmentToolCalls += 1;
        await saveCheckpoint();
      }
      if (event.type === 'turn_completed') {
        segmentTurns += 1;
        segmentUsage = {
          inputTokens: segmentUsage.inputTokens + event.usage.inputTokens,
          outputTokens: segmentUsage.outputTokens + event.usage.outputTokens,
          cacheReadTokens:
            segmentUsage.cacheReadTokens + event.usage.cacheReadTokens,
          cacheWriteTokens:
            segmentUsage.cacheWriteTokens + event.usage.cacheWriteTokens,
          estimatedCostUsd:
            segmentUsage.estimatedCostUsd + event.usage.estimatedCostUsd,
        };
        await saveCheckpoint();
      }
    };

    const onState = async (state: PiRuntimeStateSnapshot): Promise<void> => {
      messages = [...state.messages];
      if (state.phase === 'tool_result' && state.completedToolCallId) {
        completedToolCallIds.add(state.completedToolCallId);
      }
      await saveCheckpoint();
    };

    let runTools = this.tools
      .createRunTools({
        allowedPermissions: request.allowedPermissions,
        redactError: (value) => request.model.redactError(value),
      })
      .map((tool) => ({
        ...tool,
        execute: async (
          input: unknown,
          context: Parameters<typeof tool.execute>[1],
        ) => {
          if (completedToolCallIds.has(context.toolCallId)) {
            return { skipped: true, reason: 'Tool Call already completed' };
          }
          return tool.execute(input, context);
        },
      }));
    if (checkpoint.submitted) {
      runTools = runTools.filter((tool) => tool.name === 'save_skill');
    }

    try {
      await this.prisma.run.update({
        where: { id: request.runId },
        data: {
          status: 'RUNNING',
          startedAt: persisted.startedAt ?? new Date(),
          errorCode: null,
          errorMessage: null,
        },
        select: { id: true },
      });
      if (controller.signal.aborted) {
        throw new AgentRunnerError('CANCELED', 'Agent Run was canceled');
      }

      const remainingLimits = remainingRunLimits(request.limits, baseBudget);
      if (!remainingLimits) {
        throw new AgentRunnerError(
          'RESOURCE_LIMIT',
          'Agent Run has exhausted its configured resource budget',
        );
      }
      const result = await this.runtime.run({
        runId: request.runId,
        systemPrompt: request.systemPrompt,
        prompt: request.prompt,
        messages: loaded?.messages,
        model: request.model,
        tools: runTools,
        limits: remainingLimits,
        signal: controller.signal,
        onEvent,
        onState,
      });
      messages = [...result.messages];
      segmentTurns = result.turns;
      segmentToolCalls = result.toolCalls;
      segmentUsage = { ...result.usage };
      await saveCheckpoint();
      const submission = this.submissions.get(request.runId);
      if (!submission) {
        throw new AgentRunnerError(
          'MISSING_SUBMISSION',
          'Agent Run finished without a Digest submission',
        );
      }
      const output = {
        submission,
        evidence: this.evidenceLedgers.get(request.runId).snapshot(),
        runtime: result,
        resumed: Boolean(loaded),
      };
      this.logger.log(
        JSON.stringify({
          event: 'agent_run_completed',
          runId: request.runId,
          topicId: request.topicId,
          status: 'SUCCEEDED',
          resumed: Boolean(loaded),
          durationMs: Date.now() - runStartedAt,
          turns: result.turns,
          toolCalls: result.toolCalls,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedCostUsd: result.usage.estimatedCostUsd,
        }),
      );
      return output;
    } catch (error) {
      const canceled =
        controller.signal.aborted ||
        (error instanceof PiRuntimeError && error.code === 'ABORTED') ||
        (error instanceof AgentRunnerError && error.code === 'CANCELED');
      if (canceled) {
        await this.prisma.run.update({
          where: { id: request.runId },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
            errorCode: 'CANCELED',
            errorMessage: 'Agent Run was canceled',
          },
          select: { id: true },
        });
        this.logger.warn(
          JSON.stringify({
            event: 'agent_run_completed',
            runId: request.runId,
            topicId: request.topicId,
            status: 'CANCELED',
            resumed: Boolean(loaded),
            durationMs: Date.now() - runStartedAt,
          }),
        );
        throw new AgentRunnerError('CANCELED', 'Agent Run was canceled');
      }
      await this.prisma.run.update({
        where: { id: request.runId },
        data: {
          status: 'FAILED',
          errorCode:
            error instanceof PiRuntimeError
              ? error.code
              : error instanceof AgentRunnerError
                ? error.code
                : 'AGENT_RUN_FAILED',
          errorMessage:
            error instanceof PiRuntimeError || error instanceof AgentRunnerError
              ? error.message.slice(0, 500)
              : 'Agent Run failed unexpectedly',
        },
        select: { id: true },
      });
      this.logger.error(
        JSON.stringify({
          event: 'agent_run_completed',
          runId: request.runId,
          topicId: request.topicId,
          status: 'FAILED',
          resumed: Boolean(loaded),
          durationMs: Date.now() - runStartedAt,
          errorCode:
            error instanceof PiRuntimeError || error instanceof AgentRunnerError
              ? error.code
              : 'AGENT_RUN_FAILED',
        }),
      );
      throw error;
    } finally {
      clearInterval(cancellationPoll);
      request.signal?.removeEventListener('abort', abortFromCaller);
      this.runContexts.delete(request.runId);
      this.evidenceLedgers.delete(request.runId);
      this.submissions.delete(request.runId);
      this.activatedSkills.delete(request.runId);
    }
  }
}

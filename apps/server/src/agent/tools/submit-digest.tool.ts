/**
 * [INPUT]: Structured Digest submission from the Agent
 * [OUTPUT]: One evidence-validated submission per Run
 * [POS]: Terminal Tool and authority for finalized Agent output
 */

import type { DigestSubmission } from '../contracts/digest-submission.schema';
import { DigestSubmissionSchema } from '../contracts/digest-submission.schema';
import type { RegisteredAgentToolDefinition } from './agent-tool-registry.service';
import {
  type EvidenceLedgerStore,
  normalizeEvidenceUrl,
} from './evidence-ledger';

export class DigestSubmissionStore {
  private readonly submissions = new Map<string, DigestSubmission>();

  submit(runId: string, submission: DigestSubmission): { duplicate: boolean } {
    const existing = this.submissions.get(runId);
    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(submission)) {
        return { duplicate: true };
      }
      throw new Error('Run already has a different Digest submission');
    }
    this.submissions.set(runId, structuredClone(submission));
    return { duplicate: false };
  }

  get(runId: string): DigestSubmission | undefined {
    const submission = this.submissions.get(runId);
    return submission ? structuredClone(submission) : undefined;
  }

  delete(runId: string): void {
    this.submissions.delete(runId);
  }

  initialize(runId: string, submission?: DigestSubmission): void {
    this.delete(runId);
    if (submission) this.submit(runId, submission);
  }
}

export function createSubmitDigestTool(
  evidenceLedgers: EvidenceLedgerStore,
  submissions: DigestSubmissionStore,
): RegisteredAgentToolDefinition<DigestSubmission, unknown> {
  return {
    name: 'submit_digest',
    description:
      'Submit the final Digest. Every item URL must come from evidence collected in this Run.',
    inputSchema: DigestSubmissionSchema,
    permission: 'run.submit',
    timeoutMs: 2_000,
    maxResultChars: 1_000,
    execute: (input, context) => {
      const ledger = evidenceLedgers.get(context.runId);
      const seen = new Set<string>();
      const normalizedItems = input.items.map((item) => {
        const url = normalizeEvidenceUrl(item.url);
        if (seen.has(url)) throw new Error('Digest contains a duplicate URL');
        if (!ledger.hasUrl(url)) {
          throw new Error('Digest URL is not present in this Run evidence');
        }
        seen.add(url);
        return { ...item, url };
      });
      const submission: DigestSubmission = {
        ...input,
        items: normalizedItems,
      };
      const { duplicate } = submissions.submit(context.runId, submission);
      return Promise.resolve({
        accepted: true,
        duplicate,
        itemCount: submission.items.length,
      });
    },
  };
}

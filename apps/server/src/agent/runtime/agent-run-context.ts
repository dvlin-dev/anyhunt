/**
 * [INPUT]: Active Run ID and immutable Topic identity
 * [OUTPUT]: In-process lookup used by Topic-scoped Tools
 * [POS]: Minimal active-run metadata; not a workflow or persistence State
 */

export interface AgentRunContext {
  runId: string;
  topicId: string;
}

export class AgentRunContextStore {
  private readonly contexts = new Map<string, AgentRunContext>();

  set(context: AgentRunContext): void {
    this.contexts.set(context.runId, { ...context });
  }

  get(runId: string): AgentRunContext {
    const context = this.contexts.get(runId);
    if (!context) throw new Error('Agent Run context is not active');
    return { ...context };
  }

  delete(runId: string): void {
    this.contexts.delete(runId);
  }
}

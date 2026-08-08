import { describe, expect, it } from 'vitest';
import { toRunDiagnostics } from './formatters';

describe('toRunDiagnostics', () => {
  it('keeps only the explicit operational allowlist', () => {
    const result = toRunDiagnostics({
      model: { modelId: 'gpt-test', providerId: 'secret-provider' },
      tools: { web_search: 2, 'mcp.news.lookup': 1 },
      turns: 3,
      toolCalls: 3,
      usage: { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.01 },
      resumed: true,
      prompt: 'private prompt',
      skill: 'private skill body',
      apiKey: 'secret',
      checkpoint: { messages: ['private'] },
    });

    expect(result).toEqual({
      modelId: 'gpt-test',
      tools: [
        { name: 'web_search', count: 2 },
        { name: 'mcp.news.lookup', count: 1 },
      ],
      toolCalls: 3,
      turns: 3,
      inputTokens: 100,
      outputTokens: 20,
      estimatedCostUsd: 0.01,
      resumed: true,
    });
    expect(result).not.toHaveProperty('prompt');
    expect(result).not.toHaveProperty('skill');
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('checkpoint');
  });
});

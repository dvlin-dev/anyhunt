/**
 * [INPUT]: Pi public ESM entry points
 * [OUTPUT]: Typed native dynamic import functions for the CommonJS NestJS host
 * [POS]: Single interoperability boundary; contains no Agent or product logic
 */

import type * as AgentCore from '@earendil-works/pi-agent-core';
import type * as PiAi from '@earendil-works/pi-ai';
import type { StreamFn } from '@earendil-works/pi-agent-core';
import { createRequire } from 'node:module';

type SupportedPiApi =
  | 'anthropic-messages'
  | 'google-generative-ai'
  | 'openai-completions'
  | 'openai-responses';

const requireFromHere = createRequire(__filename);
const bridge = requireFromHere('./pi-esm-loader.cjs') as {
  loadAgentCore(): Promise<typeof AgentCore>;
  loadPiAi(): Promise<typeof PiAi>;
  loadStreamModule(api: SupportedPiApi): Promise<{ streamSimple: StreamFn }>;
};

export const loadPiAgentCore = () => bridge.loadAgentCore();
export const loadPiAi = () => bridge.loadPiAi();

export async function loadPiStream(api: SupportedPiApi): Promise<StreamFn> {
  return (await bridge.loadStreamModule(api)).streamSimple;
}

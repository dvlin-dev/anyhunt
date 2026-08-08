'use strict';

const loadAgentCore = () => import('@earendil-works/pi-agent-core');
const loadPiAi = () => import('@earendil-works/pi-ai');

const PI_STREAM_MODULES = {
  'anthropic-messages': () =>
    import('@earendil-works/pi-ai/api/anthropic-messages'),
  'google-generative-ai': () =>
    import('@earendil-works/pi-ai/api/google-generative-ai'),
  'openai-completions': () =>
    import('@earendil-works/pi-ai/api/openai-completions'),
  'openai-responses': () =>
    import('@earendil-works/pi-ai/api/openai-responses'),
};

const loadStreamModule = (api) => {
  const load = PI_STREAM_MODULES[api];
  if (!load) throw new Error(`Unsupported Pi API: ${api}`);
  return load();
};

module.exports = { loadAgentCore, loadPiAi, loadStreamModule };

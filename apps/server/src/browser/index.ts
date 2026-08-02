/**
 * Browser 模块导出
 *
 * [PROVIDES]: Browser 模块对外导出
 * [POS]: 统一出口，避免跨模块直接引用内部实现
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */

export { BrowserModule } from './browser.module';
export { BrowserPool, BrowserUnavailableError } from './browser-pool';

// Stealth
export {
  StealthCdpService,
  StealthRegionService,
  buildStealthScript,
  STEALTH_CHROMIUM_ARGS,
  type StealthScriptOptions,
  type RiskSignal,
  type RegionSignal,
} from './stealth';
// Types
export type {
  BrowserInstance,
  WaitingRequest,
  BrowserPoolStatus,
} from './browser.types';

// Constants
export {
  BROWSER_POOL_SIZE,
  BROWSER_IDLE_TIMEOUT,
  BROWSER_ACQUIRE_TIMEOUT,
  MAX_PAGES_PER_BROWSER,
  DEFAULT_VIEWPORT_WIDTH,
  DEFAULT_VIEWPORT_HEIGHT,
} from './browser.constants';

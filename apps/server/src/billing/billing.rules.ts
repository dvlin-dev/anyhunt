/**
 * [PROVIDES]: 计费规则（billingKey -> cost），支持 env 覆盖
 * [DEPENDS]: process.env
 * [POS]: 计费配置中心（单一数据源）
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */

export const DEFAULT_BILLING_COST = 1;

export const BILLING_KEYS = [
  'digest.acquire.scrape',
  'digest.acquire.search',
  'digest.acquire.map',
] as const;

export type BillingKey = (typeof BILLING_KEYS)[number];

export interface BillingRule {
  cost: number;
  /**
   * 命中缓存时不扣费（例如 scrape 返回 { fromCache: true }）。
   */
  skipIfFromCache?: boolean;
  /**
   * 失败时退费（异步任务在最终 FAILED 时退）。
   */
  refundOnFailure?: boolean;
}

const BASE_RULES: Record<BillingKey, BillingRule> = {
  'digest.acquire.scrape': {
    cost: 1,
    skipIfFromCache: true,
    refundOnFailure: true,
  },
  'digest.acquire.search': { cost: 1, refundOnFailure: true },
  'digest.acquire.map': { cost: 1, refundOnFailure: true },
};

/**
 * 运行时覆盖（最佳实践：配置集中、改动可控）：
 * - 设置 `BILLING_RULE_OVERRIDES_JSON` 为 JSON：{ "digest.acquire.scrape": 2 }
 * - 仅覆盖 cost；其他规则（skipIfFromCache/refundOnFailure）仍使用 BASE_RULES
 *
 * 说明：此覆盖是“重启生效”的设计。如果未来需要动态修改，
 * 可将规则迁移到数据库而不改变调用点。
 */
function loadCostOverridesFromEnv(): Partial<
  Record<BillingKey, number>
> | null {
  const raw = process.env.BILLING_RULE_OVERRIDES_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const overrides: Partial<Record<BillingKey, number>> = {};

    for (const key of BILLING_KEYS) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        overrides[key] = value;
      }
    }

    return overrides;
  } catch (error) {
    console.warn(
      '[BillingRules] Invalid BILLING_RULE_OVERRIDES_JSON, ignored',
      error,
    );
    return null;
  }
}

let cachedOverrides: Partial<Record<BillingKey, number>> | null | undefined;

export function getBillingRule(key: BillingKey): BillingRule {
  const base = BASE_RULES[key] ?? {
    cost: DEFAULT_BILLING_COST,
    refundOnFailure: true,
  };

  if (cachedOverrides === undefined) {
    cachedOverrides = loadCostOverridesFromEnv();
  }

  const overrideCost = cachedOverrides?.[key];
  if (overrideCost === undefined) return base;

  return { ...base, cost: overrideCost };
}

/**
 * Scraper DTO - Zod Schemas
 *
 * [INPUT]: 抓取请求参数
 * [OUTPUT]: 验证后的抓取选项
 * [POS]: Zod schemas + 推断类型（用于验证）
 */

import { z } from 'zod';

// ========== 子 Schema ==========

// 视口 Schema
export const ViewportSchema = z.object({
  width: z.number().int().min(100).max(3840).default(1280),
  height: z.number().int().min(100).max(2160).default(800),
});

// Action Schema
export const ActionSchema = z.object({
  type: z.enum(['click', 'type', 'scroll', 'wait', 'press']),
  selector: z.string().optional(),
  text: z.string().optional(),
  key: z.string().optional(),
  direction: z.enum(['up', 'down']).optional(),
  amount: z.number().optional(),
  milliseconds: z.number().optional(),
});

// ========== 主请求 Schema ==========

export const ScrapeOptionsSchema = z.object({
  url: z.string().url(),
  formats: z
    .array(z.enum(['markdown', 'html', 'rawHtml', 'links']))
    .default(['markdown']),
  onlyMainContent: z.boolean().default(true),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  waitFor: z.union([z.number(), z.string()]).optional(),
  timeout: z.number().default(30000),
  headers: z.record(z.string(), z.string()).optional(),

  // 视口设置
  viewport: ViewportSchema.optional(),
  mobile: z.boolean().default(false),
  device: z.enum(['desktop', 'tablet', 'mobile']).optional(),
  darkMode: z.boolean().default(false),

  // Actions (页面交互)
  actions: z.array(ActionSchema).optional(),
});

// ========== 推断类型 ==========

export type ScrapeOptions = z.infer<typeof ScrapeOptionsSchema>;
export type Action = z.infer<typeof ActionSchema>;

// 抓取格式类型
export type ScrapeFormat = 'markdown' | 'html' | 'rawHtml' | 'links';

// ========== 常量 ==========

// 设备预设
export const DEVICE_PRESETS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: {
    width: 375,
    height: 667,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },
} as const;

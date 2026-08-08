/**
 * Scraper 模块类型定义
 *
 * [DEFINES]: PageMetadata, ScrapeResult
 * [USED_BY]: scraper.service.ts
 * [POS]: 响应类型和内部数据结构（不用于验证）
 */

// 页面元数据
export interface PageMetadata {
  title?: string;
  description?: string;
  author?: string;
  keywords?: string[];
  language?: string;
  publishedTime?: string;
  modifiedTime?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  ogSiteName?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  favicon?: string;
  canonicalUrl?: string;
  robots?: string;
}

// 抓取结果
export interface ScrapeResult {
  id: string;
  url: string;
  fromCache: boolean;
  markdown?: string;
  html?: string;
  rawHtml?: string;
  links?: string[];
  metadata?: PageMetadata;
  timings?: {
    queueWaitMs: number;
    fetchMs: number;
    renderMs: number;
    transformMs: number;
    totalMs: number;
  };
}

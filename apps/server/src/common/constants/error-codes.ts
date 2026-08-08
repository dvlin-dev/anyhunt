/**
 * [DEFINES]: Runtime error codes shared by web collection services
 * [USED_BY]: Scraper handlers and HTTP error mapping
 * [POS]: Database-independent error contract for collection infrastructure
 */

export const ScrapeErrorCode = {
  PAGE_TIMEOUT: 'PAGE_TIMEOUT',
  URL_NOT_ALLOWED: 'URL_NOT_ALLOWED',
  SELECTOR_NOT_FOUND: 'SELECTOR_NOT_FOUND',
  BROWSER_ERROR: 'BROWSER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_URL: 'INVALID_URL',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  ACCESS_DENIED: 'ACCESS_DENIED',
  STORAGE_ERROR: 'STORAGE_ERROR',
} as const;

export type ScrapeErrorCode =
  (typeof ScrapeErrorCode)[keyof typeof ScrapeErrorCode];

export const ERROR_CODE_HTTP_STATUS: Record<ScrapeErrorCode, number> = {
  [ScrapeErrorCode.PAGE_TIMEOUT]: 504,
  [ScrapeErrorCode.URL_NOT_ALLOWED]: 403,
  [ScrapeErrorCode.SELECTOR_NOT_FOUND]: 400,
  [ScrapeErrorCode.BROWSER_ERROR]: 500,
  [ScrapeErrorCode.NETWORK_ERROR]: 502,
  [ScrapeErrorCode.RATE_LIMITED]: 429,
  [ScrapeErrorCode.INVALID_URL]: 400,
  [ScrapeErrorCode.PAGE_NOT_FOUND]: 404,
  [ScrapeErrorCode.ACCESS_DENIED]: 403,
  [ScrapeErrorCode.STORAGE_ERROR]: 500,
};

export const ERROR_CODE_MESSAGES: Record<ScrapeErrorCode, string> = {
  [ScrapeErrorCode.PAGE_TIMEOUT]: 'Page load timed out',
  [ScrapeErrorCode.URL_NOT_ALLOWED]: 'URL is not allowed (SSRF protection)',
  [ScrapeErrorCode.SELECTOR_NOT_FOUND]: 'CSS selector not found on page',
  [ScrapeErrorCode.BROWSER_ERROR]: 'Browser encountered an error',
  [ScrapeErrorCode.NETWORK_ERROR]: 'Network error occurred',
  [ScrapeErrorCode.RATE_LIMITED]: 'Rate limit exceeded',
  [ScrapeErrorCode.INVALID_URL]: 'Invalid URL format',
  [ScrapeErrorCode.PAGE_NOT_FOUND]: 'Page not found (404)',
  [ScrapeErrorCode.ACCESS_DENIED]: 'Access denied (403)',
  [ScrapeErrorCode.STORAGE_ERROR]: 'File storage error',
};

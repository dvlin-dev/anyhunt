/**
 * [INPUT]: 环境变量（PORT/TRUST_PROXY/ALLOWED_ORIGINS/...）与反代请求头（X-Forwarded-Proto/Host）
 * [OUTPUT]: 启动 NestJS HTTP 服务并挂载全局中间件/拦截器
 * [POS]: Anyhunt Server 入口（反代部署必须启用 trust proxy）
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */

import { NestFactory } from '@nestjs/core';
import { HttpStatus, Logger, VersioningType } from '@nestjs/common';
import {
  json,
  urlencoded,
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { buildProblemDetails, getRequestId, matchOrigin } from './common/utils';
import { DEVICE_PLATFORM_ALLOWLIST } from './auth/auth.constants';
import { getTrustedOrigins } from './auth/auth.config';

function resolveTrustProxyConfig(logger: Logger): boolean | number {
  const raw = process.env.TRUST_PROXY;
  if (!raw || raw.trim().length === 0) {
    return 1;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  const hops = Number.parseInt(raw, 10);
  if (Number.isInteger(hops) && hops >= 0) {
    return hops;
  }

  logger.warn(`Invalid TRUST_PROXY="${raw}", fallback to 1 (single proxy hop)`);
  return 1;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // 保留原始请求体用于 Webhook 签名验证
    rawBody: true,
  });

  // 反代部署必须启用 trust proxy，否则 req.protocol/secure cookie 等会被错误识别为 http。
  // 默认值 1（单层反代）；多层反代可通过 TRUST_PROXY=true 或具体 hop 数调整。
  const trustProxy = resolveTrustProxyConfig(logger);
  (app.getHttpAdapter().getInstance() as Application).set(
    'trust proxy',
    trustProxy,
  );
  logger.log(`Express trust proxy set to: ${String(trustProxy)}`);

  // 增加请求体大小限制（默认 100kb，增加到 50mb）
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // 请求 ID（用于 RFC7807 错误体与链路排查）
  app.use((req: Request, res: Response, next: NextFunction) => {
    const header = req.headers['x-request-id'];
    const requestId =
      typeof header === 'string' && header.trim().length > 0
        ? header
        : randomUUID();
    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // 全局 API 前缀
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/(.*)'],
  });

  // URI 版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS 配置 - 生产环境必须配置 ALLOWED_ORIGINS
  // Support wildcard subdomains such as https://*.anyhunt.app.
  const isDev = process.env.NODE_ENV !== 'production';
  const allowedPatterns = getTrustedOrigins();

  if (!isDev && allowedPatterns.length === 0) {
    throw new Error(
      'TRUSTED_ORIGINS environment variable must be set in production',
    );
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin && req.headers.cookie) {
      const platformHeader = req.headers['x-app-platform'];
      const platform = Array.isArray(platformHeader)
        ? platformHeader[0]
        : platformHeader;
      const normalized =
        typeof platform === 'string' ? platform.toLowerCase() : '';
      if (!DEVICE_PLATFORM_ALLOWLIST.has(normalized)) {
        const problem = buildProblemDetails({
          status: HttpStatus.FORBIDDEN,
          code: 'FORBIDDEN',
          message: 'Missing origin',
          requestId: getRequestId(req),
        });
        res
          .status(HttpStatus.FORBIDDEN)
          .type('application/problem+json')
          .json(problem);
        return;
      }
    }
    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // 开发环境且未配置允许列表：允许所有来源
      if (isDev && allowedPatterns.length === 0) {
        callback(null, true);
        return;
      }

      if (!origin) {
        callback(null, true);
        return;
      }

      // 检查是否匹配任一允许的模式（支持通配符）
      const isAllowed = allowedPatterns.some((pattern) =>
        matchOrigin(origin, pattern),
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS: Origin not allowed: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Application running on port ${port}`);
  logger.log(`📊 Health check: http://localhost:${port}/health`);
}

void bootstrap();

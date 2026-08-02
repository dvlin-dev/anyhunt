import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { json, urlencoded, type Request, type Response } from 'express';
import { PrismaModule } from './prisma';
import { IdempotencyModule } from './idempotency';
import { RedisModule } from './redis';
import { QueueModule } from './queue';
import { EmailModule } from './email';
import { AuthModule } from './auth';
import { UserModule } from './user';
import { PaymentModule } from './payment';
import { StorageModule } from './storage';
import { HealthModule } from './health';
import { QuotaModule } from './quota';
import { BrowserModule } from './browser';
import { ScraperModule } from './scraper';
import { MapModule } from './map';
import { SearchModule } from './search';
import { AdminModule } from './admin';
import { CommonModule } from './common';
import {
  GLOBAL_THROTTLE_CONFIG,
  RedisThrottlerStorageService,
  ThrottleModule,
  UserThrottlerGuard,
  type GlobalThrottleConfig,
  shouldSkipGlobalThrottle,
} from './common/guards';
import { RedemptionModule } from './redemption';
import { DigestModule } from './digest';
import { NotFoundModule } from './not-found';
import { LlmModule } from './llm';
import { LogModule, RequestLogMiddleware } from './log';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottleModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottleModule],
      inject: [GLOBAL_THROTTLE_CONFIG, RedisThrottlerStorageService],
      useFactory: (
        config: GlobalThrottleConfig,
        storage: RedisThrottlerStorageService,
      ) => ({
        storage,
        skipIf: (context) => {
          const req = context
            .switchToHttp()
            .getRequest<Request & { originalUrl?: string }>();
          const path = req.originalUrl ?? req.url ?? req.path ?? '/';
          return shouldSkipGlobalThrottle(path, config.skipPaths);
        },
        throttlers: [
          {
            ttl: config.ttlMs,
            limit: config.limit,
            blockDuration: config.blockDurationMs,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    IdempotencyModule,
    RedisModule,
    QueueModule,
    CommonModule,
    LogModule,
    EmailModule,
    AuthModule,
    UserModule,
    PaymentModule,
    StorageModule,
    HealthModule,
    QuotaModule,
    BrowserModule,
    ScraperModule,
    MapModule,
    SearchModule,
    AdminModule,
    LlmModule,
    DigestModule,
    RedemptionModule,
    // NotFoundModule must be LAST to catch all unmatched routes
    NotFoundModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 保留原始 body 以支持 Better Auth 与 Webhook 验签
    const captureRawBody = (
      req: Request & { rawBody?: Buffer },
      _res: Response,
      buf: Buffer,
    ) => {
      if (buf?.length) {
        req.rawBody = Buffer.from(buf);
      }
    };

    consumer
      .apply(
        json({ verify: captureRawBody, limit: '50mb' }),
        urlencoded({ extended: true, verify: captureRawBody, limit: '50mb' }),
      )
      .forRoutes('*');

    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}

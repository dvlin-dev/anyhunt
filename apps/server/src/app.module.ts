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
import { HealthModule } from './health';
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
import { NotFoundModule } from './not-found';
import { LlmModule } from './llm';
import { LogModule, RequestLogMiddleware } from './log';
import { AgentModule } from './agent/agent.module';
import { TopicModule } from './topic/topic.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { InboxModule } from './inbox/inbox.module';
import { DeliveryModule } from './delivery/delivery.module';
import { validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate: validateEnvironment,
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
    HealthModule,
    BrowserModule,
    ScraperModule,
    MapModule,
    SearchModule,
    AdminModule,
    LlmModule,
    AgentModule,
    TopicModule,
    SubscriptionModule,
    InboxModule,
    DeliveryModule,
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

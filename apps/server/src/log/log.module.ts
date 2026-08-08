/**
 * [INPUT]: none
 * [OUTPUT]: RequestLog 模块依赖注入与 Admin 查询接口
 * [POS]: 请求日志模块装配入口
 */

import { Module } from '@nestjs/common';
import { RequestLogController } from './request-log.controller';
import { RequestLogMiddleware } from './request-log.middleware';
import { RequestLogService } from './request-log.service';
import { RequestLogCleanupService } from './request-log-cleanup.service';
import { OperationalCleanupService } from './operational-cleanup.service';
import { OperationalMetricsService } from './operational-metrics.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [RequestLogController],
  providers: [
    RequestLogService,
    RequestLogMiddleware,
    RequestLogCleanupService,
    OperationalCleanupService,
    OperationalMetricsService,
  ],
  exports: [RequestLogService, RequestLogMiddleware],
})
export class LogModule {}

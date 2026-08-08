/**
 * [INPUT]: Authenticated user reports and Admin moderation requests
 * [OUTPUT]: TopicReport resources and audited Topic status transitions
 * [POS]: Topic trust-and-safety HTTP boundaries
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequireAdmin } from '../auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { CurrentUserDto } from '../types';
import {
  AdminReportQuerySchema,
  ModerateTopicSchema,
  ResolveTopicReportSchema,
  TopicReportSchema,
  type AdminReportQueryDto,
  type ModerateTopicDto,
  type ResolveTopicReportDto,
  type TopicReportDto,
} from './topic-report.schema';
import { TopicReportService } from './topic-report.service';

@ApiTags('Topic Reports')
@ApiSecurity('session')
@Controller({ path: 'app/topics', version: '1' })
export class TopicReportController {
  constructor(private readonly reports: TopicReportService) {}

  @Post(':topicId/report')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  report(
    @CurrentUser() user: CurrentUserDto,
    @Param('topicId') topicId: string,
    @Body(new ZodValidationPipe(TopicReportSchema)) input: TopicReportDto,
  ) {
    return this.reports.report(user.id, topicId, input);
  }
}

@ApiTags('Admin - Topic Moderation')
@ApiSecurity('session')
@RequireAdmin()
@Controller({ path: 'admin', version: '1' })
export class AdminTopicModerationController {
  constructor(private readonly reports: TopicReportService) {}

  @Get('topic-reports')
  list(
    @Query(new ZodValidationPipe(AdminReportQuerySchema))
    query: AdminReportQueryDto,
  ) {
    return this.reports.list(query);
  }

  @Patch('topic-reports/:id')
  resolve(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') reportId: string,
    @Body(new ZodValidationPipe(ResolveTopicReportSchema))
    input: ResolveTopicReportDto,
  ) {
    return this.reports.resolve(user.id, reportId, input.status, input.note);
  }

  @Patch('topics/:id/status')
  moderate(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') topicId: string,
    @Body(new ZodValidationPipe(ModerateTopicSchema)) input: ModerateTopicDto,
  ) {
    return this.reports.setTopicStatus(
      user.id,
      topicId,
      input.status,
      input.reason,
    );
  }
}

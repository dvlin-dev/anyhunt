/**
 * [INPUT]: Authenticated Topic and Run HTTP commands
 * [OUTPUT]: Topic resources and queued Run state
 * [POS]: User HTTP boundary for owned and forked Topics
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { CurrentUserDto } from '../types';
import {
  CreateTopicSchema,
  IdempotencyKeySchema,
  TopicVisibilityCommandSchema,
  UpdateTopicSchema,
  type CreateTopicDto,
  type TopicVisibilityCommandDto,
  type UpdateTopicDto,
} from './topic.schema';
import { TopicService } from './topic.service';

@ApiTags('Topics')
@ApiSecurity('session')
@Controller({ path: 'app/topics', version: '1' })
export class TopicController {
  constructor(private readonly topics: TopicService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserDto) {
    return this.topics.list(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  create(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(CreateTopicSchema)) input: CreateTopicDto,
  ) {
    return this.topics.create(user.id, input);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserDto, @Param('id') topicId: string) {
    return this.topics.get(user.id, topicId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') topicId: string,
    @Body(new ZodValidationPipe(UpdateTopicSchema)) input: UpdateTopicDto,
  ) {
    return this.topics.update(user.id, topicId, input);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: CurrentUserDto, @Param('id') topicId: string) {
    return this.topics.pause(user.id, topicId);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: CurrentUserDto, @Param('id') topicId: string) {
    return this.topics.resume(user.id, topicId);
  }

  @Patch(':id/visibility')
  setVisibility(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') topicId: string,
    @Body(new ZodValidationPipe(TopicVisibilityCommandSchema))
    input: TopicVisibilityCommandDto,
  ) {
    return this.topics.setVisibility(user.id, topicId, input.visibility);
  }

  @Get(':id/runs')
  listRuns(@CurrentUser() user: CurrentUserDto, @Param('id') topicId: string) {
    return this.topics.listRuns(user.id, topicId);
  }

  @Get(':id/runs/:runId')
  getRun(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') topicId: string,
    @Param('runId') runId: string,
  ) {
    return this.topics.getRun(user.id, topicId, runId);
  }

  @Post(':id/runs')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  triggerManual(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') topicId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.topics.triggerManual(
      user.id,
      topicId,
      IdempotencyKeySchema.parse(idempotencyKey),
    );
  }

  @Post(':id/runs/:runId/cancel')
  cancelRun(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') topicId: string,
    @Param('runId') runId: string,
  ) {
    return this.topics.cancelRun(user.id, topicId, runId);
  }

  @Post('fork/:slug')
  fork(@CurrentUser() user: CurrentUserDto, @Param('slug') slug: string) {
    return this.topics.fork(user.id, slug);
  }
}

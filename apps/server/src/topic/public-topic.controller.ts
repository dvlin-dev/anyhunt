/**
 * [INPUT]: Anonymous or optionally authenticated public Topic reads
 * [OUTPUT]: PUBLIC/UNLISTED/privileged Topic and successful Run projections
 * [POS]: Public read-only HTTP boundary; no Edition compatibility routes
 */

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, OptionalAuthGuard, Public } from '../auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { CurrentUserDto } from '../types';
import {
  PublicTopicsQuerySchema,
  type PublicTopicsQueryDto,
} from './topic.schema';
import { PublicTopicService } from './public-topic.service';

@Controller({ path: 'topics', version: '1' })
@Public()
@UseGuards(OptionalAuthGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PublicTopicController {
  constructor(private readonly topics: PublicTopicService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(PublicTopicsQuerySchema))
    query: PublicTopicsQueryDto,
  ) {
    return this.topics.list(query.page, query.limit);
  }

  @Get(':slug')
  get(
    @Param('slug') slug: string,
    @CurrentUser() user: CurrentUserDto | undefined,
  ) {
    return this.topics.getBySlug(slug, user);
  }

  @Get(':slug/runs/:runId')
  getRun(
    @Param('slug') slug: string,
    @Param('runId') runId: string,
    @CurrentUser() user: CurrentUserDto | undefined,
  ) {
    return this.topics.getRunBySlug(slug, runId, user);
  }
}

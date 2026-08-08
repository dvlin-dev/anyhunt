import {
  Body,
  Controller,
  Delete,
  Get,
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
  SubscriptionPreferencesSchema,
  type SubscriptionPreferencesDto,
} from './subscription.schema';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscriptions')
@ApiSecurity('session')
@Controller({ path: 'app/subscriptions', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserDto) {
    return this.subscriptions.list(user.id);
  }

  @Post(':topicId')
  subscribe(
    @CurrentUser() user: CurrentUserDto,
    @Param('topicId') topicId: string,
  ) {
    return this.subscriptions.subscribe(user.id, topicId);
  }

  @Delete(':topicId')
  cancel(
    @CurrentUser() user: CurrentUserDto,
    @Param('topicId') topicId: string,
  ) {
    return this.subscriptions.cancel(user.id, topicId);
  }

  @Patch(':topicId/preferences')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  updatePreferences(
    @CurrentUser() user: CurrentUserDto,
    @Param('topicId') topicId: string,
    @Body(new ZodValidationPipe(SubscriptionPreferencesSchema))
    input: SubscriptionPreferencesDto,
  ) {
    return this.subscriptions.updatePreferences(user.id, topicId, input);
  }
}

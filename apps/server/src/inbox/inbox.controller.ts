import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { CurrentUserDto } from '../types';
import {
  CanonicalUrlHashSchema,
  InboxQuerySchema,
  UserItemStateSchema,
  type InboxQueryDto,
  type UserItemStateDto,
} from './inbox.schema';
import { InboxService } from './inbox.service';

@ApiTags('Inbox')
@ApiSecurity('session')
@Controller({ path: 'app/inbox', version: '1' })
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserDto,
    @Query(new ZodValidationPipe(InboxQuerySchema)) query: InboxQueryDto,
  ) {
    return this.inbox.list(user.id, query);
  }

  @Patch(':canonicalUrlHash/state')
  updateState(
    @CurrentUser() user: CurrentUserDto,
    @Param('canonicalUrlHash') hash: string,
    @Body(new ZodValidationPipe(UserItemStateSchema)) input: UserItemStateDto,
  ) {
    return this.inbox.updateState(
      user.id,
      CanonicalUrlHashSchema.parse(hash),
      input,
    );
  }
}

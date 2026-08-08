/**
 * [INPUT]: Admin read-only diagnostics requests
 * [OUTPUT]: Paginated product/operational projections without credentials
 * [POS]: Admin operations HTTP boundary
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { RequireAdmin } from '../auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminOperationsService } from './admin-operations.service';
import { paginationQuerySchema, type PaginationQuery } from './dto';

@ApiTags('Admin - Operations')
@ApiSecurity('session')
@RequireAdmin()
@Controller({ path: 'admin', version: '1' })
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('topics')
  topics(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listTopics(query);
  }

  @Get('subscriptions')
  subscriptions(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listSubscriptions(query);
  }

  @Get('runs')
  runs(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listRuns(query);
  }

  @Get('deliveries')
  deliveries(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listDeliveries(query);
  }

  @Get('skills')
  skills(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listSkills(query);
  }

  @Get('providers')
  providers(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listProviders(query);
  }

  @Get('request-logs')
  requestLogs(
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.operations.listRequestLogs(query);
  }

  @Get('mcp')
  mcp() {
    return this.operations.getMcpStatus();
  }
}

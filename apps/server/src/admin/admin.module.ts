/**
 * Admin Module
 * 管理后台模块
 */

import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminQueueService } from './admin-queue.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminQueueController } from './admin-queue.controller';
import { QueueModule } from '../queue';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [QueueModule, AgentModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminQueueController,
    AdminOperationsController,
  ],
  providers: [AdminService, AdminQueueService, AdminOperationsService],
  exports: [AdminService],
})
export class AdminModule {}

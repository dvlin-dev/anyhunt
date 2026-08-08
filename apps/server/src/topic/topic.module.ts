import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AgentModule } from '../agent/agent.module';
import { SkillModule } from '../agent/skills/skill.module';
import { TopicController } from './topic.controller';
import { TopicRepositoryService } from './topic.repository.service';
import { TopicService } from './topic.service';
import { TopicRunProcessor } from './topic-run.processor';
import { TopicSchedulerProcessor } from './topic-scheduler.processor';
import { DeliveryModule } from '../delivery/delivery.module';
import { PublicTopicController } from './public-topic.controller';
import { PublicTopicService } from './public-topic.service';
import {
  AdminTopicModerationController,
  TopicReportController,
} from './topic-report.controller';
import { TopicReportService } from './topic-report.service';
import { AuthModule } from '../auth';

@Module({
  imports: [AuthModule, QueueModule, AgentModule, SkillModule, DeliveryModule],
  controllers: [
    TopicController,
    PublicTopicController,
    TopicReportController,
    AdminTopicModerationController,
  ],
  providers: [
    TopicRepositoryService,
    TopicService,
    TopicSchedulerProcessor,
    TopicRunProcessor,
    PublicTopicService,
    TopicReportService,
  ],
  exports: [TopicRepositoryService, TopicService],
})
export class TopicModule {}

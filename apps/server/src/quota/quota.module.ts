/**
 * [DEFINES]: 配额模块
 * [USED_BY]: app.module.ts
 * [POS]: 配额模块入口，注册服务和控制器
 */

import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { QuotaRepository } from './quota.repository';
import { DailyCreditsService } from './daily-credits.service';

@Module({
  providers: [QuotaService, QuotaRepository, DailyCreditsService],
  exports: [QuotaService, QuotaRepository, DailyCreditsService],
})
export class QuotaModule {}

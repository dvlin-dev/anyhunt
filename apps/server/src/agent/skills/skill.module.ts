import { Module } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { SkillPackageService } from './skill-package.service';
import { SkillRepositoryService } from './skill-repository.service';
import { SkillService } from './skill.service';

@Module({
  controllers: [SkillController],
  providers: [SkillPackageService, SkillRepositoryService, SkillService],
  exports: [SkillPackageService, SkillRepositoryService, SkillService],
})
export class SkillModule {}

/**
 * [INPUT]: Authenticated Skill list/import/update/status/rollback/export requests
 * [OUTPUT]: Owner-scoped Skill resources or standard Agent Skill ZIP files
 * [POS]: User HTTP boundary for Agent Skills
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../auth';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getContentDisposition } from '../../common/utils/content-disposition';
import type { CurrentUserDto } from '../../types';
import { SKILL_PACKAGE_LIMITS } from './skill-package.schema';
import {
  SkillRollbackSchema,
  SkillStatusSchema,
  SkillUrlImportSchema,
  type SkillRollbackDto,
  type SkillStatusDto,
  type SkillUrlImportDto,
} from './skill.schema';
import { SkillService } from './skill.service';

type UploadedSkillFile = { buffer: Buffer; size: number };

@ApiTags('Skills')
@ApiSecurity('session')
@Controller({ path: 'app/skills', version: '1' })
export class SkillController {
  constructor(private readonly skills: SkillService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserDto) {
    return this.skills.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserDto, @Param('id') skillId: string) {
    return this.skills.get(user.id, skillId);
  }

  @Post('import')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: SKILL_PACKAGE_LIMITS.archiveBytes, files: 1 },
    }),
  )
  importZip(
    @CurrentUser() user: CurrentUserDto,
    @UploadedFile() file: UploadedSkillFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Skill ZIP file is required');
    return this.skills.importZip(user.id, file.buffer);
  }

  @Post('import-url')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  importUrl(
    @CurrentUser() user: CurrentUserDto,
    @Body(new ZodValidationPipe(SkillUrlImportSchema)) dto: SkillUrlImportDto,
  ) {
    return this.skills.importFromUrl(user.id, dto.url);
  }

  @Post(':id/update-url')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  updateUrl(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
    @Body(new ZodValidationPipe(SkillUrlImportSchema)) dto: SkillUrlImportDto,
  ) {
    return this.skills.updateFromUrl(user.id, skillId, dto.url);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
    @Body(new ZodValidationPipe(SkillStatusSchema)) dto: SkillStatusDto,
  ) {
    return this.skills.setEnabled(user.id, skillId, dto.enabled);
  }

  @Post(':id/rollback')
  rollback(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
    @Body(new ZodValidationPipe(SkillRollbackSchema)) dto: SkillRollbackDto,
  ) {
    return this.skills.rollback(user.id, skillId, dto.version);
  }

  @Get(':id/export')
  async export(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const skill = await this.skills.get(user.id, skillId);
    const archive = await this.skills.exportZip(user.id, skillId);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      getContentDisposition(`${skill.name}.zip`),
    );
    return new StreamableFile(Buffer.from(archive));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
  ): Promise<void> {
    await this.skills.archive(user.id, skillId);
  }

  @Post(':id/topics/:topicId')
  attachToTopic(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
    @Param('topicId') topicId: string,
  ) {
    return this.skills.attachToTopic(user.id, topicId, skillId);
  }

  @Delete(':id/topics/:topicId')
  detachFromTopic(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') skillId: string,
    @Param('topicId') topicId: string,
  ) {
    return this.skills.detachFromTopic(user.id, topicId, skillId);
  }
}

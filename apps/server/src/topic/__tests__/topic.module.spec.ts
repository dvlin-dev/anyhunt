/**
 * [PROVIDES]: TopicModule 可选鉴权依赖边界回归测试
 * [DEPENDS]: Nest 模块元数据、AuthModule
 * [POS]: 防止公开 Topic 控制器的 OptionalAuthGuard 在生产启动时缺少依赖
 */

import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuthModule } from '../../auth';
import { TopicModule } from '../topic.module';

describe('TopicModule', () => {
  it('imports AuthModule for OptionalAuthGuard dependencies', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      TopicModule,
    ) as unknown[];

    expect(imports).toContain(AuthModule);
  });
});

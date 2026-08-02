/**
 * Browser 模块
 *
 * [INPUT]: 浏览器会话与自动化请求
 * [OUTPUT]: Digest acquisition 使用的 BrowserPool
 * [POS]: 内部抓取基础设施，不暴露浏览器会话或 Agent API
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */

import { Module, Global } from '@nestjs/common';
import { BrowserPool } from './browser-pool';
import { StealthCdpService, StealthRegionService } from './stealth';

@Global()
@Module({
  providers: [BrowserPool, StealthCdpService, StealthRegionService],
  exports: [BrowserPool],
})
export class BrowserModule {}

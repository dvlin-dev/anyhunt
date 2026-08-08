// apps/server/src/map/map.module.ts
import { Module } from '@nestjs/common';
import { MapService } from './map.service';
import { SitemapParser } from './sitemap-parser';

@Module({
  providers: [MapService, SitemapParser],
  exports: [MapService],
})
export class MapModule {}

/**
 * [PROVIDES]: Frozen Agent Tool registry, Pi runtime, model resolver, Runner, and checkpoints
 * [DEPENDS]: Existing collection services, Skill module, Prisma, and deployment-owned MCP config
 * [POS]: Composition root for the Anyhunt Agent Runtime
 */

import {
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { UrlValidator } from '../common/validators/url.validator';
import { LlmModule } from '../llm/llm.module';
import { MapModule } from '../map/map.module';
import { MapService } from '../map/map.service';
import { ScraperModule } from '../scraper/scraper.module';
import { ScraperService } from '../scraper/scraper.service';
import { SearchModule } from '../search/search.module';
import { SearchService } from '../search/search.service';
import { McpClientManagerService } from './mcp/mcp-client-manager.service';
import { parseMcpServersConfig } from './mcp/mcp.config';
import { AgentCheckpointService } from './runtime/agent-checkpoint.service';
import { AgentRunContextStore } from './runtime/agent-run-context';
import { AgentRunnerService } from './runtime/agent-runner.service';
import { PiAgentRuntimeService } from './runtime/pi-agent-runtime.service';
import { PiModelResolverService } from './runtime/pi-model-resolver.service';
import { SkillModule } from './skills/skill.module';
import { SkillPackageService } from './skills/skill-package.service';
import { SkillService } from './skills/skill.service';
import {
  ActivatedSkillStore,
  createActivateSkillTool,
} from './tools/activate-skill.tool';
import { AgentToolRegistryService } from './tools/agent-tool-registry.service';
import { createCrawlSiteTool } from './tools/crawl-site.tool';
import { EvidenceLedgerStore } from './tools/evidence-ledger';
import { createReadRssTool } from './tools/read-rss.tool';
import { createSaveSkillTool } from './tools/save-skill.tool';
import {
  createSubmitDigestTool,
  DigestSubmissionStore,
} from './tools/submit-digest.tool';
import { createWebFetchTool } from './tools/web-fetch.tool';
import { createWebSearchTool } from './tools/web-search.tool';

@Injectable()
class AgentToolBootstrapService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly registry: AgentToolRegistryService,
    private readonly mcp: McpClientManagerService,
    private readonly search: SearchService,
    private readonly scraper: ScraperService,
    private readonly map: MapService,
    private readonly urlValidator: UrlValidator,
    private readonly ledgers: EvidenceLedgerStore,
    private readonly submissions: DigestSubmissionStore,
    private readonly skills: SkillService,
    private readonly skillPackages: SkillPackageService,
    private readonly runContexts: AgentRunContextStore,
    private readonly activatedSkills: ActivatedSkillStore,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registry.register(
      createWebSearchTool(this.search, this.urlValidator, this.ledgers),
    );
    this.registry.register(
      createWebFetchTool(this.scraper, this.urlValidator, this.ledgers),
    );
    this.registry.register(createReadRssTool(this.urlValidator, this.ledgers));
    this.registry.register(
      createCrawlSiteTool(this.map, this.urlValidator, this.ledgers),
    );
    this.registry.register(
      createActivateSkillTool(
        this.skills,
        (runId) => this.runContexts.get(runId).topicId,
        this.activatedSkills,
      ),
    );
    this.registry.register(
      createSubmitDigestTool(this.ledgers, this.submissions),
    );
    this.registry.register(
      createSaveSkillTool(
        this.skillPackages,
        this.skills,
        (runId) => this.runContexts.get(runId).topicId,
      ),
    );
    for (const tool of await this.mcp.initialize()) {
      this.registry.register(tool);
    }
    this.registry.freeze();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mcp.close();
  }
}

@Module({
  imports: [LlmModule, SearchModule, ScraperModule, MapModule, SkillModule],
  providers: [
    AgentToolRegistryService,
    EvidenceLedgerStore,
    DigestSubmissionStore,
    ActivatedSkillStore,
    AgentRunContextStore,
    AgentCheckpointService,
    PiAgentRuntimeService,
    PiModelResolverService,
    AgentRunnerService,
    {
      provide: McpClientManagerService,
      inject: [UrlValidator, EvidenceLedgerStore],
      useFactory: (
        urlValidator: UrlValidator,
        evidenceLedgers: EvidenceLedgerStore,
      ) =>
        new McpClientManagerService(
          parseMcpServersConfig(process.env.ANYHUNT_MCP_SERVERS_JSON),
          urlValidator,
          evidenceLedgers,
        ),
    },
    AgentToolBootstrapService,
  ],
  exports: [
    AgentRunnerService,
    AgentCheckpointService,
    PiModelResolverService,
    McpClientManagerService,
  ],
})
export class AgentModule {}

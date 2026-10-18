import { Inject, Injectable, Logger } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MetricsService } from '../metrics/metrics.service';
import { DevicesService } from '../devices/devices.service';
import { SeriesService } from '../series/series.service';
import { StatsService } from '../stats/stats.service';
import { AppService } from '../app.service';
import { getMcpConfig, MCP_SERVER_INSTRUCTIONS, McpConfig } from './mcp.config';
import { McpDomainServices, McpToolContext } from './tools/tool-definition';
import { registerAllTools } from './tools/tool-registry';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    @Inject(MetricsService)
    private readonly metricsService: MetricsService,
    @Inject(DevicesService)
    private readonly devicesService: DevicesService,
    @Inject(SeriesService)
    private readonly seriesService: SeriesService,
    @Inject(StatsService)
    private readonly statsService: StatsService,
    @Inject(AppService)
    private readonly appService: AppService
  ) {}

  getConfig(): McpConfig {
    return getMcpConfig();
  }

  getDomainServices(): McpDomainServices {
    return {
      metricsService: this.metricsService,
      devicesService: this.devicesService,
      seriesService: this.seriesService,
      statsService: this.statsService,
      appService: this.appService,
    };
  }

  async createServer(contextOverrides?: Partial<McpToolContext>): Promise<McpServer> {
    const config = this.getConfig();
    const server = new McpServer(
      {
        name: 'iot-dashboard-telemetry',
        version: '1.0.0',
      },
      {
        instructions: MCP_SERVER_INSTRUCTIONS,
      }
    );

    const context: McpToolContext = {
      maxPointsPerCall: config.maxPointsPerCall,
      ...contextOverrides,
    };

    await registerAllTools(server, this.getDomainServices(), context);
    return server;
  }

  async handleRequest(
    req: FastifyRequest,
    reply: FastifyReply,
    contextOverrides?: Partial<McpToolContext>
  ): Promise<void> {
    reply.hijack();

    const server = await this.createServer(contextOverrides);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  }
}

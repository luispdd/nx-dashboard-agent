import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { DevicesModule } from '../devices/devices.module';
import { SeriesModule } from '../series/series.module';
import { StatsModule } from '../stats/stats.module';
import { AppService } from '../app.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpGuard } from './mcp.guard';

@Module({
  imports: [MetricsModule, DevicesModule, SeriesModule, StatsModule],
  controllers: [McpController],
  providers: [McpService, McpGuard, AppService],
  exports: [McpService],
})
export class McpModule {}

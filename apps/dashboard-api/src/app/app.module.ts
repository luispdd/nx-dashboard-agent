import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
import { DatabaseModule } from './database/database.module';
import { MetricsModule } from './metrics/metrics.module';
import { DevicesModule } from './devices/devices.module';
import { SeriesModule } from './series/series.module';
import { StatsModule } from './stats/stats.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    DatabaseModule,
    MetricsModule,
    DevicesModule,
    SeriesModule,
    StatsModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}

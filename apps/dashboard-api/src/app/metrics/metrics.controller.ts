import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { MetricItemDto } from './dto/metric-item.dto';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService)
    private readonly metricsService: MetricsService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve metrics catalog with units' })
  @ApiResponse({
    status: 200,
    description: 'Array of declared metrics and physical units',
    type: [MetricItemDto],
  })
  async getMetrics(): Promise<MetricItemDto[]> {
    return this.metricsService.getMetrics();
  }
}

import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { StatsQueryDto, StatsResponseDto } from './dto/stats-query.dto';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(
    @Inject(StatsService)
    private readonly statsService: StatsService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve statistical summaries for metrics across devices',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistical aggregation summaries',
    type: StatsResponseDto,
  })
  async getStats(@Query() query: StatsQueryDto): Promise<StatsResponseDto> {
    return this.statsService.getStats(query);
  }
}

import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import { SeriesQueryDto, SeriesResponseDto } from './dto/series-query.dto';

@ApiTags('series')
@Controller('series')
export class SeriesController {
  constructor(
    @Inject(SeriesService)
    private readonly seriesService: SeriesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve downsampled time-series measurements grouped by device',
  })
  @ApiResponse({
    status: 200,
    description: 'Downsampled multi-device series response',
    type: SeriesResponseDto,
  })
  async getSeries(@Query() query: SeriesQueryDto): Promise<SeriesResponseDto> {
    return this.seriesService.getSeries(query);
  }
}

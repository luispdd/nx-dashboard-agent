import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { DatabaseStatusDto } from './database/database-status.dto';

@ApiTags('database')
@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API root health endpoint' })
  getData() {
    return this.appService.getData();
  }

  @Get('database/status')
  @ApiOperation({ summary: 'Retrieve database provenance and status' })
  @ApiResponse({
    status: 200,
    description: 'Current database provenance metadata and record statistics',
    type: DatabaseStatusDto,
  })
  async getDatabaseStatus(): Promise<DatabaseStatusDto> {
    return await this.appService.getDatabaseStatus();
  }
}


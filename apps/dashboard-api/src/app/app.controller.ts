import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Readable } from 'stream';
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

  @Post('database/import')
  @ApiOperation({
    summary: 'Upload SQLite database file and trigger in-process ETL',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'SQLite database file (.db, .sqlite, .sqlite3)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Database successfully imported and transformed',
    type: DatabaseStatusDto,
  })
  async importDatabase(@Req() req: FastifyRequest): Promise<DatabaseStatusDto> {
    const file = await (
      req as unknown as {
        file?: () => Promise<
          { file: Readable; filename: string } | undefined
        >;
      }
    ).file?.();
    if (!file) {
      throw new BadRequestException('No database file was uploaded.');
    }
    return await this.appService.importDatabase(file.file, file.filename);
  }

  @Post('database/reset-demo')
  @ApiOperation({
    summary: 'Reset database to synthetic demo data',
    description: 'Generates fresh synthetic seed telemetry and runs ETL with demo metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Database successfully reset to demo data',
    type: DatabaseStatusDto,
  })
  async resetDemoDatabase(): Promise<DatabaseStatusDto> {
    return await this.appService.resetDemoDatabase();
  }
}

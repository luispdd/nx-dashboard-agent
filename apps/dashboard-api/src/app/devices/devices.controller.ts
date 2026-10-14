import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(
    @Inject(DevicesService)
    private readonly devicesService: DevicesService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve distinct list of active device IDs' })
  @ApiResponse({
    status: 200,
    description: 'Array of device identifier strings',
    type: [String],
    example: ['esp32c6', 'esp32node1', 'esp32s3'],
  })
  async getDevices(): Promise<string[]> {
    return this.devicesService.getDevices();
  }
}

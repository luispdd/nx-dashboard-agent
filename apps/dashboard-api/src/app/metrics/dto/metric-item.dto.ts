import { ApiProperty } from '@nestjs/swagger';

export class MetricItemDto {
  @ApiProperty({
    description: 'Metric key identifier',
    example: 'temperature',
  })
  metric_key!: string;

  @ApiProperty({
    description: 'Measurement physical unit',
    example: '°C',
  })
  unit!: string;
}

import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

import {
  DEFAULT_INCLUDE_ON_DEMAND,
  ISO_UTC_MESSAGE,
  ISO_UTC_REGEX,
} from '../../common/domain-constants';

export class StatsQueryDto {
  @ApiProperty({
    description: 'Metric key identifier (e.g. temperature, humidity, pressure)',
    example: 'temperature',
  })
  @IsString()
  @IsNotEmpty()
  metric!: string;

  @ApiPropertyOptional({
    description: 'Comma-separated device identifiers or single device ID',
    example: 'esp32c6,esp32s3',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    }
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  })
  devices?: string[];

  @ApiPropertyOptional({
    description: 'Start timestamp in ISO-8601 UTC with Z suffix',
    example: '2026-10-05T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  @Matches(ISO_UTC_REGEX, {
    message: ISO_UTC_MESSAGE,
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'End timestamp in ISO-8601 UTC with Z suffix',
    example: '2026-10-06T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  @Matches(ISO_UTC_REGEX, {
    message: ISO_UTC_MESSAGE,
  })
  to?: string;

  @ApiPropertyOptional({
    description: 'Include on-demand manual readings in aggregate (default false)',
    default: DEFAULT_INCLUDE_ON_DEMAND,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_on_demand?: boolean = DEFAULT_INCLUDE_ON_DEMAND;
}

export class StatsItemDto {
  @ApiProperty({ example: 'esp32c6' })
  device_id!: string;

  @ApiProperty({ example: 14.5, nullable: true })
  min!: number | null;

  @ApiProperty({ example: 28.2, nullable: true })
  max!: number | null;

  @ApiProperty({ example: 21.3, nullable: true })
  mean!: number | null;

  @ApiProperty({ example: 2.15, nullable: true })
  std!: number | null;

  @ApiProperty({ example: 288 })
  count!: number;

  @ApiProperty({ example: 0.0 })
  missing_ratio!: number;
}

export class StatsResponseDto {
  @ApiProperty({ example: 'temperature' })
  metric!: string;

  @ApiProperty({ example: '°C' })
  unit!: string;

  @ApiProperty({ type: [StatsItemDto] })
  stats!: StatsItemDto[];
}

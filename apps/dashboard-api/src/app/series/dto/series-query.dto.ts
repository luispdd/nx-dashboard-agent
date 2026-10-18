import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  Matches,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import {
  BUCKET_INTERVALS,
  BucketInterval,
  DEFAULT_BUCKET_INTERVAL,
  DEFAULT_INCLUDE_ON_DEMAND,
  ISO_UTC_MESSAGE,
  ISO_UTC_REGEX,
  bucketToSeconds,
} from '../../common/domain-constants';

export { BucketInterval, bucketToSeconds };

export class SeriesQueryDto {
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
    description: 'Downsampling bucket interval (5m, 15m, 1h, 6h, 1d)',
    enum: BUCKET_INTERVALS,
    default: DEFAULT_BUCKET_INTERVAL,
  })
  @IsOptional()
  @IsIn(BUCKET_INTERVALS)
  bucket?: BucketInterval = DEFAULT_BUCKET_INTERVAL;

  @ApiPropertyOptional({
    description: 'Include on-demand manual readings in aggregate (default false)',
    default: DEFAULT_INCLUDE_ON_DEMAND,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_on_demand?: boolean = DEFAULT_INCLUDE_ON_DEMAND;

  @ApiPropertyOptional({
    description: 'Limit output to the latest N data points per device',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SeriesPointDto {
  @ApiProperty({ example: '2026-10-05T08:00:00Z' })
  ts!: string;

  @ApiProperty({ example: 21.4 })
  value!: number;
}

export class DeviceSeriesDto {
  @ApiProperty({ example: 'esp32c6' })
  device_id!: string;

  @ApiProperty({ type: [SeriesPointDto] })
  points!: SeriesPointDto[];
}

export class SeriesResponseDto {
  @ApiProperty({ example: 'temperature' })
  metric!: string;

  @ApiProperty({ example: '°C' })
  unit!: string;

  @ApiProperty({ example: '5m' })
  bucket!: string;

  @ApiProperty({ type: [DeviceSeriesDto] })
  series!: DeviceSeriesDto[];
}

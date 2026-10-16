import { ApiProperty } from '@nestjs/swagger';

export class DatabaseStatusDto {
  @ApiProperty({
    description: 'Indicates whether the active database contains synthetic demo data',
    example: true,
  })
  isDemo!: boolean;

  @ApiProperty({
    description: 'Total count of readings processed into the database',
    example: 6174,
  })
  readingCount!: number;

  @ApiProperty({
    description: 'Total count of distinct IoT devices represented',
    example: 3,
  })
  deviceCount!: number;

  @ApiProperty({
    type: String,
    description: 'ISO-8601 UTC timestamp of when data was last imported',
    nullable: true,
    example: '2026-10-16T16:39:00Z',
  })
  lastImportedAt!: string | null;
}

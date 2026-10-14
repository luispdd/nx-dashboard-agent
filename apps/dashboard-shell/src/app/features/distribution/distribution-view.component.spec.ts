import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StatsService, MetricsService, DevicesService } from 'shared-contracts';
import { CapabilitiesService } from '../../core/services/capabilities.service';
import { DistributionViewComponent } from './distribution-view.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DistributionViewComponent', () => {
  let component: DistributionViewComponent;
  let fixture: ComponentFixture<DistributionViewComponent>;
  let statsService: { statsControllerGetStats: ReturnType<typeof vi.fn> };
  let capabilitiesService: CapabilitiesService;

  const mockStatsResponse = {
    metric: 'temperature',
    unit: '°C',
    stats: [
      {
        device_id: 'esp32c6',
        count: 75,
        min: 20.0,
        max: 25.0,
        mean: 22.5,
        std: 1.2,
        missing_ratio: 0.05,
      },
      {
        device_id: 'esp32s3',
        count: 25,
        min: 18.0,
        max: 22.0,
        mean: 20.0,
        std: 0.8,
        missing_ratio: 0.4,
      },
    ],
  };

  const mockMetricsService = {
    metricsControllerGetMetrics: vi.fn().mockReturnValue(
      of([
        { metric_key: 'temperature', unit: '°C' },
        { metric_key: 'humidity', unit: '%' },
      ])
    ),
  };

  const mockDevicesService = {
    devicesControllerGetDevices: vi.fn().mockReturnValue(
      of(['esp32c6', 'esp32s3'])
    ),
  };

  const mockStatsService = {
    statsControllerGetStats: vi.fn(),
  };

  beforeEach(async () => {
    mockStatsService.statsControllerGetStats.mockReset();
    mockStatsService.statsControllerGetStats.mockReturnValue(
      of(mockStatsResponse)
    );

    await TestBed.configureTestingModule({
      imports: [DistributionViewComponent],
      providers: [
        CapabilitiesService,
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: StatsService, useValue: mockStatsService },
      ],
    }).compileComponents();

    capabilitiesService = TestBed.inject(CapabilitiesService);
    statsService = TestBed.inject(StatsService) as unknown as {
      statsControllerGetStats: ReturnType<typeof vi.fn>;
    };
    fixture = TestBed.createComponent(DistributionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create distribution view component', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-select metric and fetch stats', async () => {
    await capabilitiesService.loadCatalog();
    fixture.detectChanges();

    expect(component.selectedMetric()).toBe('temperature');
    expect(statsService.statsControllerGetStats).toHaveBeenCalledWith('temperature');
  });

  it('should compute total readings, donut series and labels accurately', async () => {
    component.selectedMetric.set('temperature');
    await component.fetchStats();
    fixture.detectChanges();

    expect(component.totalReadings()).toBe(100);
    expect(component.donutSeries()).toEqual([75, 25]);
    expect(component.donutLabels()).toEqual(['esp32c6', 'esp32s3']);
  });

  it('should compute distribution rows with percentages and health statuses', async () => {
    component.selectedMetric.set('temperature');
    await component.fetchStats();
    fixture.detectChanges();

    const rows = component.distributionRows();
    expect(rows.length).toBe(2);

    expect(rows[0].device_id).toBe('esp32c6');
    expect(rows[0].count).toBe(75);
    expect(rows[0].percentage).toBe(75);
    expect(rows[0].healthStatus).toBe('healthy');

    expect(rows[1].device_id).toBe('esp32s3');
    expect(rows[1].count).toBe(25);
    expect(rows[1].percentage).toBe(25);
    expect(rows[1].healthStatus).toBe('degraded'); // missing_ratio = 0.4 > 0.25
  });

  it('should handle error when stats query fails', async () => {
    statsService.statsControllerGetStats.mockReturnValue(
      throwError(() => new Error('Stats failure'))
    );

    component.selectedMetric.set('temperature');
    await component.fetchStats();
    fixture.detectChanges();

    expect(component.error()).toBe('Stats failure');
    expect(component.hasData()).toBe(false);
  });
});

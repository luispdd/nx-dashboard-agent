import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SeriesService, MetricsService, DevicesService } from 'shared-contracts';
import { CapabilitiesService } from '../../core/services/capabilities.service';
import { TrendsViewComponent } from './trends-view.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TrendsViewComponent', () => {
  let component: TrendsViewComponent;
  let fixture: ComponentFixture<TrendsViewComponent>;
  let seriesService: { seriesControllerGetSeries: ReturnType<typeof vi.fn> };
  let capabilitiesService: CapabilitiesService;

  const mockSeriesResponse = {
    metric: 'temperature',
    unit: '°C',
    bucket: '15m',
    series: [
      {
        device_id: 'esp32c6',
        points: [
          { ts: '2026-10-14T10:00:00Z', value: 22.4 },
          { ts: '2026-10-14T10:15:00Z', value: 22.8 },
        ],
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

  const mockSeriesService = {
    seriesControllerGetSeries: vi.fn(),
  };

  beforeEach(async () => {
    localStorage.clear();
    mockSeriesService.seriesControllerGetSeries.mockReset();
    mockSeriesService.seriesControllerGetSeries.mockReturnValue(
      of(mockSeriesResponse)
    );

    await TestBed.configureTestingModule({
      imports: [TrendsViewComponent],
      providers: [
        CapabilitiesService,
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: SeriesService, useValue: mockSeriesService },
      ],
    }).compileComponents();

    capabilitiesService = TestBed.inject(CapabilitiesService);
    seriesService = TestBed.inject(SeriesService) as unknown as {
      seriesControllerGetSeries: ReturnType<typeof vi.fn>;
    };
    fixture = TestBed.createComponent(TrendsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create trends view component', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-select the first metric and fetch series when catalog loads', async () => {
    await capabilitiesService.loadCatalog();
    fixture.detectChanges();

    expect(component.selectedMetric()).toBe('temperature');
    expect(seriesService.seriesControllerGetSeries).toHaveBeenCalled();
  });

  it('should pass limit query parameter when latest points are selected', async () => {
    await capabilitiesService.loadCatalog();
    fixture.detectChanges();

    component.selectedPoints.set(50);
    component.selectedRange.set(null);
    await component.fetchSeries();

    expect(seriesService.seriesControllerGetSeries).toHaveBeenCalledWith(
      'temperature',
      undefined,
      undefined,
      undefined,
      '5m',
      false, // includeOnDemand = false
      50
    );
  });

  it('should pass time range and bucket when range is selected', async () => {
    await capabilitiesService.loadCatalog();
    fixture.detectChanges();

    component.selectedRange.set('1h');
    component.selectedPoints.set(null);
    await component.fetchSeries();

    expect(seriesService.seriesControllerGetSeries).toHaveBeenCalledWith(
      'temperature',
      undefined,
      expect.any(String), // from timestamp
      undefined,
      '5m', // 1h bucket
      false,
      undefined
    );
  });

  it('should set error message when series fetch fails', async () => {
    seriesService.seriesControllerGetSeries.mockReturnValue(
      throwError(() => new Error('Network error'))
    );

    component.selectedMetric.set('temperature');
    await component.fetchSeries();

    expect(component.seriesError()).toBe('Network error');
    expect(component.seriesData()).toEqual([]);
  });

  it('should update seriesData and currentUnit on successful response', async () => {
    seriesService.seriesControllerGetSeries.mockReturnValue(
      of(mockSeriesResponse)
    );

    component.selectedMetric.set('temperature');
    await component.fetchSeries();

    expect(component.seriesData()).toEqual(mockSeriesResponse.series);
    expect(component.currentUnit()).toBe('°C');
  });

  it('should synchronize active context into DashboardContextService on filter change', async () => {
    await capabilitiesService.loadCatalog();
    fixture.detectChanges();

    component.selectedMetric.set('humidity');
    component.selectedDevice.set('esp32s3');
    component.selectedRange.set('7d');
    component.onFilterChanged();

    const context = component.contextService.activeContext();
    expect(context.selectedMetric).toBe('humidity');
    expect(context.selectedDevices).toEqual(['esp32s3']);
    expect(context.timeRange?.preset).toBe('7d');
  });
});

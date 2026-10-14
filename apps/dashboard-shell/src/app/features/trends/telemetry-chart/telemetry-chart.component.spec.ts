import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TelemetryChartComponent } from './telemetry-chart.component';
import { DeviceSeriesDto } from 'shared-contracts';

describe('TelemetryChartComponent', () => {
  let component: TelemetryChartComponent;
  let fixture: ComponentFixture<TelemetryChartComponent>;

  const mockSeries: DeviceSeriesDto[] = [
    {
      device_id: 'esp32-01',
      points: [
        { ts: '2026-10-14T10:00:00Z', value: 21.5 },
        { ts: '2026-10-14T10:05:00Z', value: 22.0 },
      ],
    },
    {
      device_id: 'esp32-02',
      points: [
        { ts: '2026-10-14T10:00:00Z', value: 19.8 },
        { ts: '2026-10-14T10:05:00Z', value: 20.1 },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetryChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TelemetryChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute hasData true when series has data points', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.detectChanges();
    expect(component.hasData()).toBe(true);
  });

  it('should compute hasData false when series is empty', () => {
    fixture.componentRef.setInput('series', []);
    fixture.detectChanges();
    expect(component.hasData()).toBe(false);
  });

  it('should format chartSeries correctly and map timestamps to milliseconds', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.detectChanges();

    const chartSeries = component.chartSeries();
    expect(chartSeries.length).toBe(2);
    expect(chartSeries[0].name).toBe('esp32-01');

    const expectedTime = new Date('2026-10-14T10:00:00Z').getTime();
    const seriesData = chartSeries[0].data as { x: number; y: number | null }[];
    const firstPoint = seriesData[0];
    expect(firstPoint.x).toBe(expectedTime);
    expect(firstPoint.y).toBe(21.5);
  });

  it('should insert null points for gaps exceeding the threshold', () => {
    const seriesWithGap: DeviceSeriesDto[] = [
      {
        device_id: 'esp32-01',
        points: [
          { ts: '2026-10-14T10:00:00Z', value: 20.0 },
          // Gap of 30 minutes with 5m bucket (threshold is 9m)
          { ts: '2026-10-14T10:30:00Z', value: 25.0 },
        ],
      },
    ];

    fixture.componentRef.setInput('series', seriesWithGap);
    fixture.componentRef.setInput('bucket', '5m');
    fixture.detectChanges();

    const chartSeries = component.chartSeries();
    const data = chartSeries[0].data as { x: number; y: number | null }[];
    expect(data.length).toBe(3); // First point, null gap point, second point
    expect(data[1].y).toBeNull();
    expect(data[2].y).toBe(25.0);
  });

  it('should configure datetimeUTC as false for viewer local timezone formatting', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.detectChanges();

    expect(component.xaxis().labels?.datetimeUTC).toBe(false);
  });

  it('should apply deviceColorMap correctly', () => {
    const colorMap = new Map([
      ['esp32-01', '#2DD4BF'],
      ['esp32-02', '#38BDF8'],
    ]);

    fixture.componentRef.setInput('series', mockSeries);
    fixture.componentRef.setInput('deviceColorMap', colorMap);
    fixture.detectChanges();

    expect(component.chartColors()).toEqual(['#2DD4BF', '#38BDF8']);
  });
});

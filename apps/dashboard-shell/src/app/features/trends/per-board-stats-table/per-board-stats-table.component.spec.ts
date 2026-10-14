import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerBoardStatsTableComponent } from './per-board-stats-table.component';
import { DeviceSeriesDto } from 'shared-contracts';

describe('PerBoardStatsTableComponent', () => {
  let component: PerBoardStatsTableComponent;
  let fixture: ComponentFixture<PerBoardStatsTableComponent>;

  const mockSeries: DeviceSeriesDto[] = [
    {
      device_id: 'esp32-beta',
      points: [
        { ts: '2026-10-14T10:00:00Z', value: 10.0 },
        { ts: '2026-10-14T10:05:00Z', value: 30.0 },
        { ts: '2026-10-14T10:10:00Z', value: 20.0 },
      ],
    },
    {
      device_id: 'esp32-alpha',
      points: [
        { ts: '2026-10-14T10:00:00Z', value: 25.5 },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerBoardStatsTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PerBoardStatsTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute statistics and measurement count accurately', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.componentRef.setInput('unit', '°C');
    fixture.detectChanges();

    const rows = component.rows();
    expect(rows.length).toBe(2);

    // Alpha is sorted first alphabetically
    const alpha = rows[0];
    expect(alpha.device_id).toBe('esp32-alpha');
    expect(alpha.count).toBe(1);
    expect(alpha.min).toBe(25.5);
    expect(alpha.max).toBe(25.5);
    expect(alpha.avg).toBe(25.5);
    expect(alpha.latest).toBe(25.5);

    // Beta
    const beta = rows[1];
    expect(beta.device_id).toBe('esp32-beta');
    expect(beta.count).toBe(3);
    expect(beta.min).toBe(10.0);
    expect(beta.max).toBe(30.0);
    expect(beta.avg).toBe(20.0);
    expect(beta.latest).toBe(20.0);
  });

  it('should format numbers with unit correctly', () => {
    fixture.componentRef.setInput('series', mockSeries);
    fixture.componentRef.setInput('unit', '°C');
    fixture.detectChanges();

    expect(component.formatValue(21.456)).toBe('21.46 °C');
    expect(component.formatValue(null)).toBe('-');
  });

  it('should map device colors from deviceColorMap', () => {
    const colorMap = new Map([
      ['esp32-alpha', '#2DD4BF'],
      ['esp32-beta', '#FBBF24'],
    ]);

    fixture.componentRef.setInput('series', mockSeries);
    fixture.componentRef.setInput('deviceColorMap', colorMap);
    fixture.detectChanges();

    const rows = component.rows();
    expect(rows[0].color).toBe('#2DD4BF');
    expect(rows[1].color).toBe('#FBBF24');
  });

  it('should handle devices with 0 points gracefully', () => {
    const emptySeries: DeviceSeriesDto[] = [
      {
        device_id: 'esp32-empty',
        points: [],
      },
    ];

    fixture.componentRef.setInput('series', emptySeries);
    fixture.detectChanges();

    const rows = component.rows();
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(0);
    expect(rows[0].min).toBeNull();
    expect(rows[0].latest).toBeNull();
  });
});

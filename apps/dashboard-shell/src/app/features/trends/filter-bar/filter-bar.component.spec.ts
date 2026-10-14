import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterBarComponent } from './filter-bar.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('FilterBarComponent', () => {
  let component: FilterBarComponent;
  let fixture: ComponentFixture<FilterBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterBarComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('metrics', [
      { metric_key: 'temperature', label: 'Temperature', unit: '°C', color: '#2DD4BF' },
      { metric_key: 'humidity', label: 'Humidity', unit: '%', color: '#38BDF8' },
    ]);
    fixture.componentRef.setInput('devices', [
      { device_id: 'esp32c6', color: '#2DD4BF' },
      { device_id: 'esp32s3', color: '#38BDF8' },
    ]);
    fixture.componentRef.setInput('selectedMetric', 'temperature');
    fixture.detectChanges();
  });

  it('should render metric pills and allow selecting a metric', () => {
    let changed = false;
    component.filterChanged.subscribe(() => {
      changed = true;
    });

    const humidityBtn = fixture.nativeElement.querySelector('[data-testid="metric-pill-humidity"]');
    humidityBtn.click();

    expect(component.selectedMetric()).toBe('humidity');
    expect(changed).toBe(true);
  });

  it('should enforce mutual exclusivity: selecting points clears time range', () => {
    expect(component.selectedRange()).toBe('1d');
    expect(component.selectedPoints()).toBeNull();

    const points50Btn = fixture.nativeElement.querySelector('[data-testid="points-btn-50"]');
    points50Btn.click();

    expect(component.selectedPoints()).toBe(50);
    expect(component.selectedRange()).toBeNull();
  });

  it('should enforce mutual exclusivity: selecting time range clears points', () => {
    component.selectedPoints.set(100);
    component.selectedRange.set(null);
    fixture.detectChanges();

    const range1hBtn = fixture.nativeElement.querySelector('[data-testid="range-btn-1h"]');
    range1hBtn.click();

    expect(component.selectedRange()).toBe('1h');
    expect(component.selectedPoints()).toBeNull();
  });

  it('should toggle sampling mode between Regular Only and All Data', () => {
    const allDataBtn = fixture.nativeElement.querySelector('[data-testid="sampling-all-btn"]');
    allDataBtn.click();

    expect(component.regularOnly()).toBe(false);

    const regularBtn = fixture.nativeElement.querySelector('[data-testid="sampling-regular-btn"]');
    regularBtn.click();

    expect(component.regularOnly()).toBe(true);
  });
});

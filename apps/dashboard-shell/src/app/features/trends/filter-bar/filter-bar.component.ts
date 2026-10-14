import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetricOption, DeviceOption } from '../../../core/services/capabilities.service';

export interface TimeRangeOption {
  label: string;
  value: string;
  durationMs: number;
  bucket: '5m' | '15m' | '1h' | '6h' | '1d';
}

export const TIME_RANGE_OPTIONS: readonly TimeRangeOption[] = [
  { label: 'Last 10m', value: '10m', durationMs: 10 * 60 * 1000, bucket: '5m' },
  { label: 'Last 1h', value: '1h', durationMs: 60 * 60 * 1000, bucket: '5m' },
  { label: 'Last 3h', value: '3h', durationMs: 3 * 3600 * 1000, bucket: '5m' },
  { label: 'Last 6h', value: '6h', durationMs: 6 * 3600 * 1000, bucket: '15m' },
  { label: 'Last 1d', value: '1d', durationMs: 24 * 3600 * 1000, bucket: '15m' },
  { label: 'Last 3d', value: '3d', durationMs: 3 * 24 * 3600 * 1000, bucket: '1h' },
  { label: 'Last 7d', value: '7d', durationMs: 7 * 24 * 3600 * 1000, bucket: '1h' },
  { label: 'Last 30d', value: '30d', durationMs: 30 * 24 * 3600 * 1000, bucket: '1d' },
];

export const POINT_OPTIONS: readonly number[] = [10, 50, 100, 200, 500];

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBarComponent {
  readonly metrics = input.required<MetricOption[]>();
  readonly devices = input.required<DeviceOption[]>();

  readonly selectedMetric = model.required<string>();
  readonly selectedDevice = model<string>('all');
  readonly selectedRange = model<string | null>('1d');
  readonly selectedPoints = model<number | null>(null);
  readonly regularOnly = model<boolean>(true);

  readonly filterChanged = output<void>();

  readonly timeRangeOptions = TIME_RANGE_OPTIONS;
  readonly pointOptions = POINT_OPTIONS;

  selectMetric(metricKey: string): void {
    if (this.selectedMetric() !== metricKey) {
      this.selectedMetric.set(metricKey);
      this.filterChanged.emit();
    }
  }

  onDeviceChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDevice.set(select.value);
    this.filterChanged.emit();
  }

  selectRange(rangeVal: string): void {
    if (this.selectedRange() !== rangeVal) {
      this.selectedRange.set(rangeVal);
      this.selectedPoints.set(null); // Mutual exclusivity: unselect points row
      this.filterChanged.emit();
    }
  }

  selectPoints(count: number): void {
    if (this.selectedPoints() !== count) {
      this.selectedPoints.set(count);
      this.selectedRange.set(null); // Mutual exclusivity: unselect range row
      this.filterChanged.emit();
    }
  }

  setRegularOnly(regular: boolean): void {
    if (this.regularOnly() !== regular) {
      this.regularOnly.set(regular);
      this.filterChanged.emit();
    }
  }
}

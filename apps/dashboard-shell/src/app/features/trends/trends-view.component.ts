import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SeriesService, DeviceSeriesDto } from 'shared-contracts';
import { CapabilitiesService } from '../../core/services/capabilities.service';
import {
  FilterBarComponent,
  TIME_RANGE_OPTIONS,
} from './filter-bar/filter-bar.component';
import { TelemetryChartComponent } from './telemetry-chart/telemetry-chart.component';
import { PerBoardStatsTableComponent } from './per-board-stats-table/per-board-stats-table.component';

@Component({
  selector: 'app-trends-view',
  standalone: true,
  imports: [
    CommonModule,
    FilterBarComponent,
    TelemetryChartComponent,
    PerBoardStatsTableComponent,
  ],
  templateUrl: './trends-view.component.html',
  styleUrl: './trends-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendsViewComponent implements OnInit {
  readonly capabilitiesService = inject(CapabilitiesService);
  private readonly seriesService = inject(SeriesService);

  readonly selectedMetric = signal<string>('');
  readonly selectedDevice = signal<string>('all');
  readonly selectedRange = signal<string | null>('1d');
  readonly selectedPoints = signal<number | null>(null);
  readonly regularOnly = signal<boolean>(true);

  readonly seriesData = signal<DeviceSeriesDto[]>([]);
  readonly currentUnit = signal<string>('');
  readonly currentBucket = signal<string>('5m');
  readonly isSeriesLoading = signal<boolean>(false);
  readonly seriesError = signal<string | null>(null);

  constructor() {
    this.restorePreferences();

    effect(() => {
      const metrics = this.capabilitiesService.metrics();
      if (metrics.length > 0 && !this.selectedMetric()) {
        this.selectedMetric.set(metrics[0].metric_key);
        this.fetchSeries();
      }
    });
  }

  ngOnInit(): void {
    if (this.selectedMetric()) {
      this.fetchSeries();
    }
  }

  onFilterChanged(): void {
    this.savePreferences();
    this.fetchSeries();
  }

  async fetchSeries(): Promise<void> {
    const metric = this.selectedMetric();
    if (!metric) return;

    this.isSeriesLoading.set(true);
    this.seriesError.set(null);

    const devices =
      this.selectedDevice() !== 'all' ? [this.selectedDevice()] : undefined;
    const includeOnDemand = !this.regularOnly();

    let bucket: '5m' | '15m' | '1h' | '6h' | '1d' = '5m';
    let from: string | undefined;
    let limit: number | undefined;

    const points = this.selectedPoints();
    const range = this.selectedRange();

    if (points != null && points > 0) {
      limit = points;
      bucket = '5m';
    } else if (range) {
      const rangeOpt = TIME_RANGE_OPTIONS.find((r) => r.value === range);
      if (rangeOpt) {
        bucket = rangeOpt.bucket;
        from = new Date(Date.now() - rangeOpt.durationMs).toISOString();
      }
    }

    try {
      const res = await firstValueFrom(
        this.seriesService.seriesControllerGetSeries(
          metric,
          devices,
          from,
          undefined,
          bucket,
          includeOnDemand,
          limit
        )
      );
      this.seriesData.set(res?.series ?? []);
      this.currentUnit.set(res?.unit ?? '');
      this.currentBucket.set(res?.bucket ?? bucket);
    } catch (err: unknown) {
      this.seriesError.set(err instanceof Error ? err.message : String(err));
      this.seriesData.set([]);
    } finally {
      this.isSeriesLoading.set(false);
    }
  }

  private savePreferences(): void {
    try {
      const prefs = {
        metric: this.selectedMetric(),
        device: this.selectedDevice(),
        range: this.selectedRange(),
        points: this.selectedPoints(),
        regularOnly: this.regularOnly(),
      };
      localStorage.setItem('dashboard_trends_prefs', JSON.stringify(prefs));
    } catch {
      // Ignore storage errors in restricted test/SSR environments
    }
  }

  private restorePreferences(): void {
    try {
      const raw = localStorage.getItem('dashboard_trends_prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.device) this.selectedDevice.set(prefs.device);
        if (prefs.range !== undefined) this.selectedRange.set(prefs.range);
        if (prefs.points !== undefined) this.selectedPoints.set(prefs.points);
        if (typeof prefs.regularOnly === 'boolean')
          this.regularOnly.set(prefs.regularOnly);
        if (prefs.metric) this.selectedMetric.set(prefs.metric);
      }
    } catch {
      // Ignore parse errors
    }
  }
}

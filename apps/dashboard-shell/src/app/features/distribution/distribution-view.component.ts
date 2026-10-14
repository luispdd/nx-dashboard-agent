import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ChartComponent } from 'ng-apexcharts';
import {
  ApexChart,
  ApexDataLabels,
  ApexLegend,
  ApexPlotOptions,
  ApexTooltip,
  ApexNoData,
} from 'ng-apexcharts';
import { StatsService, StatsItemDto } from 'shared-contracts';
import { CapabilitiesService } from '../../core/services/capabilities.service';

export interface DeviceDistributionRow {
  device_id: string;
  color: string;
  count: number;
  percentage: number;
  missingRatio: number;
  healthStatus: 'healthy' | 'degraded' | 'offline';
}

@Component({
  selector: 'app-distribution-view',
  standalone: true,
  imports: [CommonModule, ChartComponent],
  templateUrl: './distribution-view.component.html',
  styleUrl: './distribution-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DistributionViewComponent implements OnInit {
  readonly capabilitiesService = inject(CapabilitiesService);
  private readonly statsService = inject(StatsService);

  readonly selectedMetric = signal<string>('');
  readonly rawStats = signal<StatsItemDto[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const metrics = this.capabilitiesService.metrics();
      if (metrics.length > 0 && !this.selectedMetric()) {
        this.selectedMetric.set(metrics[0].metric_key);
        this.fetchStats();
      }
    });
  }

  ngOnInit(): void {
    if (this.selectedMetric()) {
      this.fetchStats();
    }
  }

  onMetricChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value && select.value !== this.selectedMetric()) {
      this.selectedMetric.set(select.value);
      this.fetchStats();
    }
  }

  async fetchStats(): Promise<void> {
    const metric = this.selectedMetric();
    if (!metric) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.statsService.statsControllerGetStats(metric)
      );
      this.rawStats.set(res?.stats ?? []);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.rawStats.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  readonly totalReadings = computed<number>(() => {
    return this.rawStats().reduce((sum, item) => sum + item.count, 0);
  });

  readonly hasData = computed<boolean>(() => {
    return this.rawStats().length > 0 && this.totalReadings() > 0;
  });

  readonly donutSeries = computed<number[]>(() => {
    return this.rawStats().map((s) => s.count);
  });

  readonly donutLabels = computed<string[]>(() => {
    return this.rawStats().map((s) => s.device_id);
  });

  readonly donutColors = computed<string[]>(() => {
    return this.rawStats().map((s) =>
      this.capabilitiesService.getDeviceColor(s.device_id)
    );
  });

  readonly distributionRows = computed<DeviceDistributionRow[]>(() => {
    const total = this.totalReadings();
    return this.rawStats().map((s) => {
      const percentage = total > 0 ? (s.count / total) * 100 : 0;
      let healthStatus: 'healthy' | 'degraded' | 'offline' = 'healthy';
      if (s.count === 0) {
        healthStatus = 'offline';
      } else if (s.missing_ratio > 0.25) {
        healthStatus = 'degraded';
      }

      return {
        device_id: s.device_id,
        color: this.capabilitiesService.getDeviceColor(s.device_id),
        count: s.count,
        percentage,
        missingRatio: s.missing_ratio,
        healthStatus,
      };
    });
  });

  readonly chart = computed<ApexChart>(() => ({
    type: 'donut',
    height: 350,
    background: 'transparent',
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 400,
    },
  }));

  readonly plotOptions = computed<ApexPlotOptions>(() => ({
    pie: {
      donut: {
        size: '68%',
        labels: {
          show: true,
          name: {
            show: true,
            fontSize: '13px',
            color: '#94A3B8',
          },
          value: {
            show: true,
            fontSize: '20px',
            fontWeight: 600,
            color: '#F8FAFC',
            formatter: (val: string) => `${val}`,
          },
          total: {
            show: true,
            label: 'Total Readings',
            color: '#94A3B8',
            fontSize: '12px',
            formatter: () => `${this.totalReadings()}`,
          },
        },
      },
    },
  }));

  readonly dataLabels = computed<ApexDataLabels>(() => ({
    enabled: true,
    formatter: (val: number) => `${Number(val).toFixed(1)}%`,
    style: {
      fontSize: '11px',
    },
    dropShadow: {
      enabled: false,
    },
  }));

  readonly legend = computed<ApexLegend>(() => ({
    position: 'bottom',
    horizontalAlign: 'center',
    labels: {
      colors: '#E2E8F0',
    },
    markers: {
      strokeWidth: 0,
      radius: 12,
    },
  }));

  readonly tooltip = computed<ApexTooltip>(() => ({
    theme: 'dark',
    y: {
      formatter: (val: number) => `${val} readings`,
    },
  }));

  readonly noData = computed<ApexNoData>(() => ({
    text: 'No distribution data available',
    style: {
      color: '#94A3B8',
      fontSize: '13px',
    },
  }));
}

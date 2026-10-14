import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexFill,
  ApexTooltip,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexNoData,
  ApexDataLabels,
} from 'ng-apexcharts';
import { DeviceSeriesDto } from 'shared-contracts';

export const BUCKET_DURATIONS_MS: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

@Component({
  selector: 'app-telemetry-chart',
  standalone: true,
  imports: [CommonModule, ChartComponent],
  templateUrl: './telemetry-chart.component.html',
  styleUrl: './telemetry-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelemetryChartComponent {
  readonly series = input.required<DeviceSeriesDto[]>();
  readonly metric = input<string>('');
  readonly unit = input<string>('');
  readonly bucket = input<string>('5m');
  readonly deviceColorMap = input<Map<string, string>>(new Map());
  readonly isLoading = input<boolean>(false);

  readonly hasData = computed<boolean>(() => {
    const list = this.series();
    return list.length > 0 && list.some((s) => s.points && s.points.length > 0);
  });

  readonly chartSeries = computed<ApexAxisChartSeries>(() => {
    const deviceSeriesList = this.series();
    const bucketMs = BUCKET_DURATIONS_MS[this.bucket()] ?? 300_000;
    const gapThresholdMs = bucketMs * 1.8;

    return deviceSeriesList.map((dev) => {
      const data: { x: number; y: number | null }[] = [];
      const points = dev.points ?? [];

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const ptTime = new Date(pt.ts).getTime();

        if (i > 0) {
          const prevTime = new Date(points[i - 1].ts).getTime();
          // If interval exceeds threshold, insert null point to preserve visual gap
          if (ptTime - prevTime > gapThresholdMs) {
            data.push({ x: prevTime + bucketMs, y: null });
          }
        }

        data.push({ x: ptTime, y: pt.value });
      }

      return {
        name: dev.device_id,
        data,
      };
    });
  });

  readonly chartColors = computed<string[]>(() => {
    const colorMap = this.deviceColorMap();
    return this.series().map(
      (s) => colorMap.get(s.device_id) ?? '#38BDF8'
    );
  });

  readonly chart = computed<ApexChart>(() => ({
    type: 'area',
    height: 380,
    background: 'transparent',
    toolbar: {
      show: false,
    },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 350,
    },
  }));

  readonly stroke = computed<ApexStroke>(() => ({
    curve: 'smooth',
    width: 2,
  }));

  readonly fill = computed<ApexFill>(() => ({
    type: 'gradient',
    gradient: {
      shade: 'dark',
      type: 'vertical',
      shadeIntensity: 0.5,
      inverseColors: false,
      opacityFrom: 0.35,
      opacityTo: 0.05,
      stops: [0, 90, 100],
    },
  }));

  readonly dataLabels = computed<ApexDataLabels>(() => ({
    enabled: false,
  }));

  readonly markers = computed<ApexMarkers>(() => ({
    size: 4,
    strokeWidth: 1,
    strokeColors: '#0B0D12',
    hover: {
      size: 6,
    },
  }));

  readonly xaxis = computed<ApexXAxis>(() => ({
    type: 'datetime',
    labels: {
      datetimeUTC: false,
      style: {
        colors: '#94A3B8',
        fontSize: '11px',
      },
    },
    axisBorder: {
      color: '#334155',
    },
    axisTicks: {
      color: '#334155',
    },
  }));

  readonly yaxis = computed<ApexYAxis>(() => ({
    labels: {
      style: {
        colors: '#94A3B8',
        fontSize: '11px',
      },
      formatter: (val: number) => {
        if (val === null || val === undefined || isNaN(val)) return '';
        return `${val.toFixed(1)} ${this.unit() || ''}`;
      },
    },
    title: {
      text: this.unit() ? `${this.metric()} (${this.unit()})` : this.metric(),
      style: {
        color: '#94A3B8',
        fontSize: '12px',
        fontWeight: 500,
      },
    },
  }));

  readonly tooltip = computed<ApexTooltip>(() => ({
    theme: 'dark',
    x: {
      format: 'yyyy-MM-dd HH:mm:ss',
    },
    y: {
      formatter: (val: number) => {
        if (val === null || val === undefined) return 'N/A';
        return `${val} ${this.unit() || ''}`;
      },
    },
  }));

  readonly grid = computed<ApexGrid>(() => ({
    borderColor: '#1E293B',
    strokeDashArray: 3,
    xaxis: {
      lines: {
        show: true,
      },
    },
    yaxis: {
      lines: {
        show: true,
      },
    },
  }));

  readonly legend = computed<ApexLegend>(() => ({
    position: 'top',
    horizontalAlign: 'right',
    labels: {
      colors: '#E2E8F0',
    },
    markers: {
      strokeWidth: 0,
      radius: 12,
    },
  }));

  readonly noData = computed<ApexNoData>(() => ({
    text: 'No telemetry data available for the selected filters',
    style: {
      color: '#94A3B8',
      fontSize: '13px',
    },
  }));
}

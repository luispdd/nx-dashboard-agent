import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceSeriesDto } from 'shared-contracts';

export interface BoardStatRow {
  device_id: string;
  color: string;
  min: number | null;
  max: number | null;
  avg: number | null;
  latest: number | null;
  count: number;
}

@Component({
  selector: 'app-per-board-stats-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './per-board-stats-table.component.html',
  styleUrl: './per-board-stats-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerBoardStatsTableComponent {
  readonly series = input.required<DeviceSeriesDto[]>();
  readonly unit = input<string>('');
  readonly deviceColorMap = input<Map<string, string>>(new Map());

  readonly rows = computed<BoardStatRow[]>(() => {
    const list = this.series();
    const colorMap = this.deviceColorMap();

    const result: BoardStatRow[] = list.map((dev) => {
      const color = colorMap.get(dev.device_id) ?? '#38BDF8';
      const points = dev.points ?? [];
      const count = points.length;

      if (count === 0) {
        return {
          device_id: dev.device_id,
          color,
          min: null,
          max: null,
          avg: null,
          latest: null,
          count: 0,
        };
      }

      const values = points.map((p) => p.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((acc, v) => acc + v, 0);
      const avg = sum / count;
      const latest = points[count - 1].value;

      return {
        device_id: dev.device_id,
        color,
        min,
        max,
        avg,
        latest,
        count,
      };
    });

    return result.sort((a, b) => a.device_id.localeCompare(b.device_id));
  });

  formatValue(val: number | null): string {
    if (val === null || val === undefined || isNaN(val)) {
      return '-';
    }
    const unitStr = this.unit() ? ` ${this.unit()}` : '';
    return `${val.toFixed(2)}${unitStr}`;
  }
}

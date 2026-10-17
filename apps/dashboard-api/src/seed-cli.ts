import { SeedService, AnomalySpec } from './app/database/seed.service';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function findWorkspaceRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(current, 'nx.json'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function parseArgs(): {
  output: string;
  days: number;
  interval: number;
  noAnomalies: boolean;
  seed: number;
} {
  const args = process.argv.slice(2);
  let output = resolve(findWorkspaceRoot(), 'data/migrations/source.db');
  let days = 7;
  let interval = 5;
  let noAnomalies = false;
  let seed = 42;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      output = resolve(process.cwd(), args[++i]);
    } else if (arg.startsWith('--output=')) {
      output = resolve(process.cwd(), arg.split('=')[1]);
    } else if (arg === '--days' || arg === '-d') {
      days = parseInt(args[++i], 10);
    } else if (arg.startsWith('--days=')) {
      days = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('-d=')) {
      days = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--interval' || arg === '-i') {
      interval = parseInt(args[++i], 10);
    } else if (arg.startsWith('--interval=')) {
      interval = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--no-anomalies') {
      noAnomalies = true;
    } else if (arg === '--seed' || arg === '-s') {
      seed = parseInt(args[++i], 10);
    } else if (arg.startsWith('--seed=')) {
      seed = parseInt(arg.split('=')[1], 10);
    }
  }

  return { output, days, interval, noAnomalies, seed };
}

const { output, days, interval, noAnomalies, seed } = parseArgs();

const anomalies: AnomalySpec[] = noAnomalies
  ? []
  : [
      {
        anomalyType: 'peer_deviation',
        deviceId: 'esp32c6',
        metricKey: 'temperature',
        startOffsetMinutes: 1440, // Day 2
        durationMinutes: 360,
        magnitude: 8.5,
      },
      {
        anomalyType: 'spike',
        deviceId: 'esp32s3',
        metricKey: 'humidity',
        startOffsetMinutes: 2880, // Day 3
        durationMinutes: 5,
        magnitude: 40.0,
      },
      {
        anomalyType: 'flatline',
        deviceId: 'esp32node1',
        metricKey: 'temperature',
        startOffsetMinutes: 4320, // Day 4
        durationMinutes: 720,
      },
      {
        anomalyType: 'gap',
        deviceId: 'esp32c6',
        metricKey: 'temperature',
        startOffsetMinutes: 5760, // Day 5
        durationMinutes: 180,
      },
    ];

const service = new SeedService();
console.log(`Generating synthetic database at: ${output}`);
try {
  const counts = service.generateSyntheticDatabase(
    output,
    {
      durationDays: days,
      intervalMinutes: interval,
      anomalies,
      isDemo: true,
    },
    seed
  );
  console.log('Generation complete!');
  console.log(`  Nodes:               ${counts.nodes}`);
  console.log(`  Sensor Capabilities: ${counts.sensorCapabilities}`);
  console.log(`  Readings:            ${counts.readings}`);
} catch (err) {
  console.error('Synthetic Seed Generation Failed:', err);
  process.exit(1);
}

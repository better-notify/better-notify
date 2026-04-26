import { runSingle } from './examples/single';
import { runSmtp } from './examples/smtp';
import { runMultiFailover } from './examples/multi-failover';
import { runMultiRoundRobin } from './examples/multi-round-robin';
import { runMultiRandom } from './examples/multi-random';
import { runDryRun } from './examples/dry-run';
import { runRateLimited } from './examples/rate-limited';
import { runObservability } from './examples/with-observability';
import { runKitchenSink } from './examples/kitchen-sink';
import { runReactEmail } from './examples/react-email';

const examples: Record<string, () => Promise<void>> = {
  single: runSingle,
  smtp: runSmtp,
  'multi-failover': runMultiFailover,
  'multi-round-robin': runMultiRoundRobin,
  'multi-random': runMultiRandom,
  'dry-run': runDryRun,
  'rate-limited': runRateLimited,
  observability: runObservability,
  'kitchen-sink': runKitchenSink,
  'react-email': runReactEmail,
};

const main = async (): Promise<void> => {
  const requested = process.argv[2] ?? process.env.EXAMPLE ?? 'single';
  const fn = examples[requested];

  if (!fn) {
    console.error(`Unknown example: ${requested}`);
    console.error(`Available: ${Object.keys(examples).join(', ')}`);
    console.error(`Usage: pnpm --filter @welcome-text/cli start <example>`);
    process.exit(1);
  }

  console.log(`▶ running example: ${requested}`);
  console.log('---');
  await fn();
  console.log('---');
  console.log('done.');
};

await main();

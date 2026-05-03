import { runSingle } from './examples/single';
import { runSmtp } from './examples/smtp';
import { runMultiFailover } from './examples/multi-failover';
import { runMultiRoundRobin } from './examples/multi-round-robin';
import { runMultiRandom } from './examples/multi-random';
import { runMultiRace } from './examples/multi-race';
import { runMultiParallel } from './examples/multi-parallel';
import { runMultiMirrored } from './examples/multi-mirrored';
import { runDryRun } from './examples/dry-run';
import { runRateLimited } from './examples/rate-limited';
import { runObservability } from './examples/with-observability';
import { runKitchenSink } from './examples/kitchen-sink';
import { runReactEmail } from './examples/react-email';
import { runBatch } from './examples/batch';
import { runHooks } from './examples/hooks';
import { runPlugins } from './examples/plugins';
import { runHttpTransport } from './examples/http-transport';
import { runMultiChannel } from './examples/multi-channel';
import { runCustomChannel } from './examples/custom-channel';
import { runPerTransportFrom } from './examples/per-transport-from';
import { runTelegram } from './examples/telegram';
import { runTelegramCrossTransport } from './examples/telegram-cross-transport';
import { runCloudflareEmail } from './examples/cloudflare-email';
import { runCloudflareEmailAttachment } from './examples/cloudflare-email-attachment';
import { runResend } from './examples/resend';
import { runResendAttachment } from './examples/resend-attachment';
import { runSlack } from './examples/slack';
import { runSlackAttachment } from './examples/slack-attachment';
import { runDiscord } from './examples/discord';
import { runDiscordAttachment } from './examples/discord-attachment';

const examples: Record<string, () => Promise<void>> = {
  single: runSingle,
  smtp: runSmtp,
  'multi-failover': runMultiFailover,
  'multi-round-robin': runMultiRoundRobin,
  'multi-random': runMultiRandom,
  'multi-race': runMultiRace,
  'multi-parallel': runMultiParallel,
  'multi-mirrored': runMultiMirrored,
  'dry-run': runDryRun,
  'rate-limited': runRateLimited,
  observability: runObservability,
  'kitchen-sink': runKitchenSink,
  'react-email': runReactEmail,
  batch: runBatch,
  hooks: runHooks,
  plugins: runPlugins,
  'http-transport': runHttpTransport,
  'multi-channel': runMultiChannel,
  'custom-channel': runCustomChannel,
  'per-transport-from': runPerTransportFrom,
  telegram: runTelegram,
  'telegram-cross-transport': runTelegramCrossTransport,
  'cloudflare-email': runCloudflareEmail,
  'cloudflare-email-attachment': runCloudflareEmailAttachment,
  resend: runResend,
  'resend-attachment': runResendAttachment,
  slack: runSlack,
  'slack-attachment': runSlackAttachment,
  discord: runDiscord,
  'discord-attachment': runDiscordAttachment,
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

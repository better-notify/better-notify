import { EmailRpcNotImplementedError } from './errors.js';
import type { ProviderResult, Provider } from './provider.js';
import type { AnyEmailRouter } from './router.js';
import type { Sender } from './sender.js';
import type { Address, RenderedMessage, SendContext } from './types.js';

type MockProviderRecord = {
  route: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers: Record<string, string>;
  attachments: number;
  subject: string;
  html: string;
  text: string;
};

export type MockProvider = Provider & {
  readonly sent: MockProviderRecord[];
  reset(): void;
};

function normalizeAddress(addr: Address): string {
  return typeof addr === 'string' ? addr : addr.address;
}

export function mockProvider(): MockProvider {
  const records: MockProviderRecord[] = [];

  return {
    name: 'mock',
    get sent() {
      return records;
    },
    async send(message: RenderedMessage, ctx: SendContext): Promise<ProviderResult> {
      const to = message.to.map(normalizeAddress);
      records.push({
        route: ctx.route,
        to,
        cc: message.cc?.map(normalizeAddress),
        bcc: message.bcc?.map(normalizeAddress),
        replyTo: message.replyTo ? normalizeAddress(message.replyTo) : undefined,
        headers: message.headers,
        attachments: message.attachments.length,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { accepted: to, rejected: [] };
    },
    reset() {
      records.length = 0;
    },
  };
}

export type CreateTestSenderOptions<R extends AnyEmailRouter> = {
  router: R;
  provider: Provider;
  hooks?: HookRecorder;
};

export function createTestSender<R extends AnyEmailRouter>(
  _opts: CreateTestSenderOptions<R>,
): Sender<R> {
  throw new EmailRpcNotImplementedError('createTestSender() (Layer 2 test utilities)');
}

export type HookRecorder = {
  readonly calls: Array<{ name: string; route: string; [k: string]: unknown }>;
  reset(): void;
};

export function recordHooks(): HookRecorder {
  throw new EmailRpcNotImplementedError('recordHooks() (Layer 2 test utilities)');
}

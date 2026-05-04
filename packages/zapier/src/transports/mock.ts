import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedZapier } from '../types.js';
import type { ZapierChannelTransportData } from './types.js';

export type MockZapierTransport = CoreMockTransport<RenderedZapier, ZapierChannelTransportData> & {
  readonly payloads: ReadonlyArray<RenderedZapier & { id: string }>;
};

export const mockZapierTransport = (): MockZapierTransport => {
  let counter = 0;
  const payloads: Array<RenderedZapier & { id: string }> = [];
  const base = createMockTransport<RenderedZapier, ZapierChannelTransportData>({
    name: 'mock-zapier',
    reply: (rendered) => {
      counter += 1;
      const id = `zapier-mock-${counter}`;
      payloads.push({ ...rendered, id });
      return { status: 200, raw: {} };
    },
  });
  const originalReset = base.reset.bind(base);
  return Object.assign(base, {
    get payloads() {
      return payloads;
    },
    reset() {
      originalReset();
      payloads.length = 0;
      counter = 0;
    },
  });
};

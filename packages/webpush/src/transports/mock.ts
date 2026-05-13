import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedWebPush } from '../types.js';
import type { WebPushTransportData } from './types.js';

export type MockWebPushTransport = CoreMockTransport<RenderedWebPush, WebPushTransportData> & {
  readonly messages: ReadonlyArray<RenderedWebPush & { id: string }>;
};

export const mockWebPushTransport = (): MockWebPushTransport => {
  let counter = 0;
  const messages: Array<RenderedWebPush & { id: string }> = [];
  const base = createMockTransport<RenderedWebPush, WebPushTransportData>({
    name: 'mock-webpush',
    reply: (rendered) => {
      counter += 1;
      const id = `webpush-mock-${counter}`;
      messages.push({ ...rendered, id });
      const subs = Array.isArray(rendered.to) ? rendered.to : rendered.to ? [rendered.to] : [];
      return {
        results: subs.map((sub) => ({ endpoint: sub.endpoint, ok: true, statusCode: 201 })),
      };
    },
  });
  return Object.assign(base, {
    get messages() {
      return messages;
    },
  });
};

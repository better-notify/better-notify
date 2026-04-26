import { createTransport, type Transport } from '@emailrpc/core';

export const mockOkSend: Transport['send'] = async (message) => ({
  accepted: message.to.map((a) => (typeof a === 'string' ? a : a.email)),
  rejected: [],
});

export const mockFailSend =
  (err: Error): Transport['send'] =>
  async () => {
    throw err;
  };

export const mockTransport = (name: string): Transport =>
  createTransport({ name, send: mockOkSend });

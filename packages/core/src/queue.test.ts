import { describe, expect, it } from 'vitest';
import { inMemoryQueue } from './queue.js';
import { EmailRpcNotImplementedError } from './errors.js';

describe('queue stubs', () => {
  it('inMemoryQueue() throws EmailRpcNotImplementedError', () => {
    expect(() => inMemoryQueue()).toThrow(EmailRpcNotImplementedError);
  });
});

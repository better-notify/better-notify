import { describe, expect, it } from 'vitest';
import { inMemoryQueue } from './queue.js';
import { NotifyRpcNotImplementedError } from './errors.js';

describe('queue stubs', () => {
  it('inMemoryQueue() throws NotifyRpcNotImplementedError', () => {
    expect(() => inMemoryQueue()).toThrow(NotifyRpcNotImplementedError);
  });
});

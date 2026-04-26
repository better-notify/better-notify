import { describe, expect, it } from 'vitest';
import {
  EmailRpcError,
  EmailRpcNotImplementedError,
  EmailRpcRateLimitedError,
  EmailRpcValidationError,
} from './errors.js';

describe('EmailRpcError', () => {
  it('defaults code to UNKNOWN', () => {
    const err = new EmailRpcError({ message: 'boom' });
    expect(err.code).toBe('UNKNOWN');
    expect(err.route).toBeUndefined();
    expect(err.messageId).toBeUndefined();
    expect(err.name).toBe('EmailRpcError');
  });

  it('preserves cause and explicit fields', () => {
    const cause = new Error('underlying');
    const err = new EmailRpcError({
      message: 'boom',
      code: 'PROVIDER',
      route: 'welcome',
      messageId: 'm1',
      cause,
    });
    expect(err.code).toBe('PROVIDER');
    expect(err.route).toBe('welcome');
    expect(err.messageId).toBe('m1');
    expect(err.cause).toBe(cause);
  });

  it('toJSON serializes fields', () => {
    const err = new EmailRpcError({
      message: 'boom',
      code: 'PROVIDER',
      route: 'welcome',
      messageId: 'm1',
    });
    expect(err.toJSON()).toEqual({
      name: 'EmailRpcError',
      message: 'boom',
      code: 'PROVIDER',
      route: 'welcome',
      messageId: 'm1',
    });
  });
});

describe('EmailRpcValidationError', () => {
  it('forces code to VALIDATION and exposes issues', () => {
    const issues = [{ message: 'bad email', path: ['to'] }];
    const err = new EmailRpcValidationError({
      message: 'invalid',
      issues,
      route: 'welcome',
    });
    expect(err.code).toBe('VALIDATION');
    expect(err.name).toBe('EmailRpcValidationError');
    expect(err.issues).toEqual(issues);
  });

  it('toJSON includes issues alongside base fields', () => {
    const issues = [{ message: 'bad', path: ['x'] }];
    const err = new EmailRpcValidationError({
      message: 'invalid',
      issues,
      route: 'welcome',
      messageId: 'm1',
    });
    expect(err.toJSON()).toEqual({
      name: 'EmailRpcValidationError',
      message: 'invalid',
      code: 'VALIDATION',
      route: 'welcome',
      messageId: 'm1',
      issues,
    });
  });
});

describe('EmailRpcRateLimitedError', () => {
  it('forces code to RATE_LIMITED and exposes key + retryAfterMs', () => {
    const err = new EmailRpcRateLimitedError({
      message: 'too many',
      route: 'welcome',
      key: 'tenant-1',
      retryAfterMs: 1500,
    });
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.name).toBe('EmailRpcRateLimitedError');
    expect(err.key).toBe('tenant-1');
    expect(err.retryAfterMs).toBe(1500);
  });

  it('toJSON includes key and retryAfterMs alongside base fields', () => {
    const err = new EmailRpcRateLimitedError({
      message: 'too many',
      route: 'welcome',
      messageId: 'm1',
      key: 'tenant-1',
      retryAfterMs: 1500,
    });
    expect(err.toJSON()).toEqual({
      name: 'EmailRpcRateLimitedError',
      message: 'too many',
      code: 'RATE_LIMITED',
      route: 'welcome',
      messageId: 'm1',
      key: 'tenant-1',
      retryAfterMs: 1500,
    });
  });
});

describe('EmailRpcNotImplementedError', () => {
  it('formats the feature name and sets code', () => {
    const err = new EmailRpcNotImplementedError('foo()');
    expect(err.code).toBe('NOT_IMPLEMENTED');
    expect(err.name).toBe('EmailRpcNotImplementedError');
    expect(err.message).toContain('foo()');
    expect(err.message).toContain('not implemented');
  });
});

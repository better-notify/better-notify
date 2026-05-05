import { describe, expect, it } from 'vitest';
import {
  NotifyRpcError,
  NotifyRpcNotImplementedError,
  NotifyRpcProviderError,
  NotifyRpcRateLimitedError,
  NotifyRpcValidationError,
} from './errors.js';

describe('NotifyRpcError', () => {
  it('defaults code to UNKNOWN', () => {
    const err = new NotifyRpcError({ message: 'boom' });
    expect(err.code).toBe('UNKNOWN');
    expect(err.route).toBeUndefined();
    expect(err.messageId).toBeUndefined();
    expect(err.name).toBe('NotifyRpcError');
  });

  it('preserves cause and explicit fields', () => {
    const cause = new Error('underlying');
    const err = new NotifyRpcError({
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
    const err = new NotifyRpcError({
      message: 'boom',
      code: 'PROVIDER',
      route: 'welcome',
      messageId: 'm1',
    });
    expect(err.toJSON()).toEqual({
      name: 'NotifyRpcError',
      message: 'boom',
      code: 'PROVIDER',
      route: 'welcome',
      messageId: 'm1',
    });
  });
});

describe('NotifyRpcValidationError', () => {
  it('forces code to VALIDATION and exposes issues', () => {
    const issues = [{ message: 'bad email', path: ['to'] }];
    const err = new NotifyRpcValidationError({
      message: 'invalid',
      issues,
      route: 'welcome',
    });
    expect(err.code).toBe('VALIDATION');
    expect(err.name).toBe('NotifyRpcValidationError');
    expect(err.issues).toEqual(issues);
  });

  it('toJSON includes issues alongside base fields', () => {
    const issues = [{ message: 'bad', path: ['x'] }];
    const err = new NotifyRpcValidationError({
      message: 'invalid',
      issues,
      route: 'welcome',
      messageId: 'm1',
    });
    expect(err.toJSON()).toEqual({
      name: 'NotifyRpcValidationError',
      message: 'invalid',
      code: 'VALIDATION',
      route: 'welcome',
      messageId: 'm1',
      issues,
    });
  });
});

describe('NotifyRpcRateLimitedError', () => {
  it('forces code to RATE_LIMITED and exposes key + retryAfterMs', () => {
    const err = new NotifyRpcRateLimitedError({
      message: 'too many',
      route: 'welcome',
      key: 'tenant-1',
      retryAfterMs: 1500,
    });
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.name).toBe('NotifyRpcRateLimitedError');
    expect(err.key).toBe('tenant-1');
    expect(err.retryAfterMs).toBe(1500);
  });

  it('toJSON includes key and retryAfterMs alongside base fields', () => {
    const err = new NotifyRpcRateLimitedError({
      message: 'too many',
      route: 'welcome',
      messageId: 'm1',
      key: 'tenant-1',
      retryAfterMs: 1500,
    });
    expect(err.toJSON()).toEqual({
      name: 'NotifyRpcRateLimitedError',
      message: 'too many',
      code: 'RATE_LIMITED',
      route: 'welcome',
      messageId: 'm1',
      key: 'tenant-1',
      retryAfterMs: 1500,
    });
  });
});

describe('NotifyRpcNotImplementedError', () => {
  it('formats the feature name and sets code', () => {
    const err = new NotifyRpcNotImplementedError('foo()');
    expect(err.code).toBe('NOT_IMPLEMENTED');
    expect(err.name).toBe('NotifyRpcNotImplementedError');
    expect(err.message).toContain('foo()');
    expect(err.message).toContain('not implemented');
  });
});

describe('NotifyRpcProviderError', () => {
  it('defaults code to PROVIDER', () => {
    const err = new NotifyRpcProviderError({
      message: 'provider failed',
      provider: 'resend',
      retriable: true,
    });
    expect(err.code).toBe('PROVIDER');
    expect(err.name).toBe('NotifyRpcProviderError');
    expect(err.provider).toBe('resend');
    expect(err.retriable).toBe(true);
    expect(err.httpStatus).toBeUndefined();
    expect(err.providerCode).toBeUndefined();
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('preserves all provider fields', () => {
    const cause = new Error('underlying');
    const err = new NotifyRpcProviderError({
      message: 'rate limited',
      code: 'RATE_LIMITED',
      provider: 'twilio',
      httpStatus: 429,
      providerCode: 20429,
      retryAfterMs: 5000,
      retriable: true,
      route: 'alerts.sms',
      messageId: 'm1',
      cause,
    });
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.provider).toBe('twilio');
    expect(err.httpStatus).toBe(429);
    expect(err.providerCode).toBe(20429);
    expect(err.retryAfterMs).toBe(5000);
    expect(err.retriable).toBe(true);
    expect(err.route).toBe('alerts.sms');
    expect(err.messageId).toBe('m1');
    expect(err.cause).toBe(cause);
  });

  it('accepts string providerCode', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid auth',
      code: 'CONFIG',
      provider: 'slack',
      providerCode: 'invalid_auth',
      retriable: false,
    });
    expect(err.providerCode).toBe('invalid_auth');
  });

  it('is instanceof NotifyRpcError', () => {
    const err = new NotifyRpcProviderError({
      message: 'boom',
      provider: 'smtp',
      retriable: false,
    });
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect(err).toBeInstanceOf(NotifyRpcProviderError);
  });

  it('toJSON includes all provider fields', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      code: 'TIMEOUT',
      provider: 'discord',
      httpStatus: undefined,
      retryAfterMs: 1500,
      retriable: true,
      route: 'alerts.discord',
      messageId: 'm2',
    });
    expect(err.toJSON()).toEqual({
      name: 'NotifyRpcProviderError',
      message: 'timeout',
      code: 'TIMEOUT',
      route: 'alerts.discord',
      messageId: 'm2',
      provider: 'discord',
      httpStatus: undefined,
      providerCode: undefined,
      retryAfterMs: 1500,
      retriable: true,
    });
  });

  it('toJSON serializes non-retriable error with all fields', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid phone',
      code: 'VALIDATION',
      provider: 'twilio',
      httpStatus: 400,
      providerCode: 21211,
      retriable: false,
      route: 'sms.welcome',
      messageId: 'm3',
    });
    expect(err.toJSON()).toEqual({
      name: 'NotifyRpcProviderError',
      message: 'invalid phone',
      code: 'VALIDATION',
      route: 'sms.welcome',
      messageId: 'm3',
      provider: 'twilio',
      httpStatus: 400,
      providerCode: 21211,
      retryAfterMs: undefined,
      retriable: false,
    });
  });
});

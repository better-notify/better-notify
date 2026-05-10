import { describe, expect, it } from 'vitest';
import { mapHttpStatus } from './map-http-status.js';

describe('mapHttpStatus', () => {
  it('maps 400 to VALIDATION', () => {
    expect(mapHttpStatus(400)).toEqual({
      code: 'VALIDATION',
      retriable: false,
    });
  });

  it('maps 422 to VALIDATION', () => {
    expect(mapHttpStatus(422)).toEqual({
      code: 'VALIDATION',
      retriable: false,
    });
  });

  it('maps 401 to CONFIG', () => {
    expect(mapHttpStatus(401)).toEqual({
      code: 'CONFIG',
      retriable: false,
    });
  });

  it('maps 403 to CONFIG', () => {
    expect(mapHttpStatus(403)).toEqual({
      code: 'CONFIG',
      retriable: false,
    });
  });

  it('maps 404 to CONFIG', () => {
    expect(mapHttpStatus(404)).toEqual({
      code: 'CONFIG',
      retriable: false,
    });
  });

  it('maps 429 to RATE_LIMITED', () => {
    expect(mapHttpStatus(429)).toEqual({
      code: 'RATE_LIMITED',
      retriable: true,
    });
  });

  it('maps 5xx to retriable PROVIDER', () => {
    expect(mapHttpStatus(500)).toEqual({
      code: 'PROVIDER',
      retriable: true,
    });
    expect(mapHttpStatus(502)).toEqual({
      code: 'PROVIDER',
      retriable: true,
    });
    expect(mapHttpStatus(503)).toEqual({
      code: 'PROVIDER',
      retriable: true,
    });
  });

  it('maps other 4xx to non-retriable PROVIDER', () => {
    expect(mapHttpStatus(409)).toEqual({
      code: 'PROVIDER',
      retriable: false,
    });
    expect(mapHttpStatus(410)).toEqual({
      code: 'PROVIDER',
      retriable: false,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { mapHttpStatus } from './map-http-status.js';
import { HttpStatusCode } from './http-status-code.js';

describe('mapHttpStatus', () => {
  it('maps 400 to VALIDATION', () => {
    expect(mapHttpStatus(HttpStatusCode.BAD_REQUEST)).toEqual({
      code: 'VALIDATION',
      retriable: false,
    });
  });

  it('maps 422 to VALIDATION', () => {
    expect(mapHttpStatus(HttpStatusCode.UNPROCESSABLE_ENTITY)).toEqual({
      code: 'VALIDATION',
      retriable: false,
    });
  });

  it('maps 401 to CONFIG', () => {
    expect(mapHttpStatus(HttpStatusCode.UNAUTHORIZED)).toEqual({
      code: 'CONFIG',
      retriable: false,
    });
  });

  it('maps 403 to CONFIG', () => {
    expect(mapHttpStatus(HttpStatusCode.FORBIDDEN)).toEqual({
      code: 'CONFIG',
      retriable: false,
    });
  });

  it('maps 404 to CONFIG', () => {
    expect(mapHttpStatus(HttpStatusCode.NOT_FOUND)).toEqual({
      code: 'CONFIG',
      retriable: false,
    });
  });

  it('maps 429 to RATE_LIMITED', () => {
    expect(mapHttpStatus(HttpStatusCode.TOO_MANY_REQUESTS)).toEqual({
      code: 'RATE_LIMITED',
      retriable: true,
    });
  });

  it('maps 5xx to retriable PROVIDER', () => {
    expect(mapHttpStatus(HttpStatusCode.INTERNAL_SERVER_ERROR)).toEqual({
      code: 'PROVIDER',
      retriable: true,
    });
    expect(mapHttpStatus(HttpStatusCode.BAD_GATEWAY)).toEqual({
      code: 'PROVIDER',
      retriable: true,
    });
    expect(mapHttpStatus(HttpStatusCode.SERVICE_UNAVAILABLE)).toEqual({
      code: 'PROVIDER',
      retriable: true,
    });
  });

  it('maps other 4xx to non-retriable PROVIDER', () => {
    expect(mapHttpStatus(HttpStatusCode.CONFLICT)).toEqual({
      code: 'PROVIDER',
      retriable: false,
    });
    expect(mapHttpStatus(HttpStatusCode.GONE)).toEqual({
      code: 'PROVIDER',
      retriable: false,
    });
  });
});

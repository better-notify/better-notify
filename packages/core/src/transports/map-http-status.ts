import type { ProviderErrorCode } from '../errors.js';
import { HttpStatusCode } from './http-status-code.js';

export type MappedHttpError = { code: ProviderErrorCode; retriable: boolean };

/** Maps an HTTP status code to a `ProviderErrorCode` and retriability flag. */
export const mapHttpStatus = (status: number): MappedHttpError => {
  switch (status) {
    case HttpStatusCode.BAD_REQUEST:
    case HttpStatusCode.UNPROCESSABLE_ENTITY:
      return { code: 'VALIDATION', retriable: false };

    case HttpStatusCode.UNAUTHORIZED:
    case HttpStatusCode.FORBIDDEN:
    case HttpStatusCode.NOT_FOUND:
      return { code: 'CONFIG', retriable: false };

    case HttpStatusCode.TOO_MANY_REQUESTS:
      return { code: 'RATE_LIMITED', retriable: true };

    default:
      return { code: 'PROVIDER', retriable: status >= HttpStatusCode.INTERNAL_SERVER_ERROR };
  }
};

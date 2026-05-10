import type { ProviderErrorCode } from '../errors.js';

export type MappedHttpError = { code: ProviderErrorCode; retriable: boolean };

export const mapHttpStatus = (status: number): MappedHttpError => {
  switch (status) {
    case 400:
    case 422:
      return { code: 'VALIDATION', retriable: false };

    case 401:
    case 403:
    case 404:
      return { code: 'CONFIG', retriable: false };

    case 429:
      return { code: 'RATE_LIMITED', retriable: true };

    default:
      return { code: 'PROVIDER', retriable: status >= 500 };
  }
};

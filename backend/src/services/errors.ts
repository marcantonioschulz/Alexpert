import type { ErrorOptions } from 'node:errors';

export type ServiceErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'UPSTREAM_ERROR';

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ServiceError';
  }
}

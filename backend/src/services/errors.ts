export type ServiceErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'UPSTREAM_ERROR';

export type ServiceErrorOptions = {
  cause?: unknown;
};

export class ServiceError extends Error {
  public readonly cause?: unknown;

  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    options?: ServiceErrorOptions
  ) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    this.name = 'ServiceError';
  }
}

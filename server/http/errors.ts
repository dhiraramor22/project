export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(entity: string): ApiError {
  return new ApiError(404, 'NOT_FOUND', `${entity} was not found.`);
}

export function forbidden(message = 'You do not have permission to perform this action.'): ApiError {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function badRequest(code: string, message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(400, code, message, details);
}

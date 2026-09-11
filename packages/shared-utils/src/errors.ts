/**
 * Typed error handling for API responses.
 */

/**
 * API Error class with status codes.
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message = 'Bad request'): ApiError {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict'): ApiError {
    return new ApiError(409, message);
  }

  static internalError(message = 'Internal server error'): ApiError {
    return new ApiError(500, message);
  }
}

/**
 * Determines if an error is an ApiError instance.
 * @param error - Error to check
 * @returns True if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Converts any error to an ApiError with an appropriate status code.
 * Prisma-specific errors are handled separately.
 * @param error - Error to convert
 * @returns ApiError instance
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  // Prisma unique constraint violation
  if (
    error instanceof Error &&
    error.message.includes('Unique constraint failed')
  ) {
    return ApiError.conflict(
      'This record already exists. Please check your input.',
    );
  }

  // Prisma not found
  if (
    error instanceof Error &&
    error.message.includes('An operation failed because')
  ) {
    return ApiError.notFound('Record not found');
  }

  if (error instanceof Error) {
    return ApiError.internalError(error.message);
  }

  return ApiError.internalError('An unknown error occurred');
}

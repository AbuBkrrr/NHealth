"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.isApiError = isApiError;
exports.toApiError = toApiError;
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
    static badRequest(message = 'Bad request') {
        return new ApiError(400, message);
    }
    static unauthorized(message = 'Unauthorized') {
        return new ApiError(401, message);
    }
    static forbidden(message = 'Forbidden') {
        return new ApiError(403, message);
    }
    static notFound(message = 'Not found') {
        return new ApiError(404, message);
    }
    static conflict(message = 'Conflict') {
        return new ApiError(409, message);
    }
    static internalError(message = 'Internal server error') {
        return new ApiError(500, message);
    }
}
exports.ApiError = ApiError;
function isApiError(error) {
    return error instanceof ApiError;
}
function toApiError(error) {
    if (isApiError(error)) {
        return error;
    }
    if (error instanceof Error &&
        error.message.includes('Unique constraint failed')) {
        return ApiError.conflict('This record already exists. Please check your input.');
    }
    if (error instanceof Error &&
        error.message.includes('An operation failed because')) {
        return ApiError.notFound('Record not found');
    }
    if (error instanceof Error) {
        return ApiError.internalError(error.message);
    }
    return ApiError.internalError('An unknown error occurred');
}

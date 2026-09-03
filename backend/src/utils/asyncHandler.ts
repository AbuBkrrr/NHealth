import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that a rejected promise is passed to
 * next(err) instead of crashing the process. Express 5 does this
 * automatically, but we target Express 4 here for broader compatibility.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

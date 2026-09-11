import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validation source types
 */
export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Create a validation middleware for a Zod schema
 * Can validate body, query params, or route params
 */
export function validateSchema(
  schema: ZodSchema,
  source: ValidationSource = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = (() => {
        switch (source) {
          case 'query':
            return req.query;
          case 'params':
            return req.params;
          default:
            return req.body;
        }
      })();

      // Parse and validate
      const validated = schema.parse(dataToValidate);

      // Store validated data back in request
      switch (source) {
        case 'query':
          req.query = validated;
          break;
        case 'params':
          req.params = validated;
          break;
        default:
          req.body = validated;
      }

      next();
    } catch (error: any) {
      // Zod error - format for response
      if (error.errors) {
        const fieldErrors = error.errors.reduce(
          (acc: Record<string, string>, err: any) => {
            const path = err.path.join('.');
            acc[path] = err.message;
            return acc;
          },
          {}
        );

        return res.status(400).json({
          error: 'Validation failed',
          details: fieldErrors,
        });
      }

      // Unknown error
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message,
      });
    }
  };
}

/**
 * Chain multiple validators
 * Example: validateMulti(
 *   validateSchema(bodySchema, 'body'),
 *   validateSchema(querySchema, 'query')
 * )
 */
export function validateMulti(...validators: any[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const validator of validators) {
      await new Promise<void>((resolve, reject) => {
        validator(req, res, (err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      }).catch((err) => {
        if (res.headersSent) return; // Already sent error
        throw err;
      });
    }
    next();
  };
}

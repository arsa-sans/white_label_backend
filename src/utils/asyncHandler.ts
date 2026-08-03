/**
 * src/utils/asyncHandler.ts
 * Wraps async route handlers to automatically forward errors to next(err).
 * Eliminates try/catch boilerplate in every controller.
 *
 * Usage:
 *   router.get('/events', asyncHandler(async (req, res) => {
 *     const events = await eventService.list();
 *     res.json(ApiResponse.success(events));
 *   }));
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

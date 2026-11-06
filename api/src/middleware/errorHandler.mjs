import { logger } from '../config/logger.mjs';
import { AppError } from '../errors/AppError.mjs';

// Express recognises an error handler by its four parameters.
export function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message }
    });
  }

  logger.error(err.message, { stack: err.stack });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  });
}

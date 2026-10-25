import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'SERVER_ERROR';
  let errors = err.errors;

  // Handle Mongoose / MongoDB specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors || {}).map((e: any) => e.message).join(', ') || 'Validation error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid format for parameter: ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account or record with this ${field} already exists.`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Your session has expired or is invalid. Please log in again.';
  }

  // Log server-side
  if (statusCode >= 500) {
    logger.error('SYSTEM_ERROR', {
      ip: req.ip,
      details: {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        code,
        message: err.message,
        stack: err.stack
      }
    });
  } else if (statusCode === 401 || statusCode === 403) {
    logger.security('AUTH_VIOLATION', {
      ip: req.ip,
      details: {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        code,
        message
      }
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors && { errors }),
    ...(ENV.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack })
  });
}

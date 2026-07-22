// src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status = 
      exception instanceof HttpException 
        ? exception.getStatus() 
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = 
      exception instanceof HttpException 
        ? exception.getResponse() 
        : 'Internal Server Error';

    // Normalized error response shape[cite: 1]
    response.status(status).json({
      success: false,
      error: {
        code: status,
        message: typeof message === 'string' ? message : (message as any).message || message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
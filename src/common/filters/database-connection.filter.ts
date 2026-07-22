import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { TypeORMError } from 'typeorm';

@Catch(TypeORMError)
export class DatabaseConnectionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseConnectionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    this.logger.error('Database connection failed', exception instanceof Error ? exception.stack : undefined);

    response.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable. Please ensure PostgreSQL is running and the configured credentials are valid.',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

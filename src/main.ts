import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { DatabaseConnectionFilter } from './common/filters/database-connection.filter';
import { loadEnvironmentFile } from './common/config/env';

loadEnvironmentFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enforces field-level validation based on DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  
  // Normalizes all exceptions so courier APIs do not leak
  app.useGlobalFilters(new GlobalExceptionFilter(), new DatabaseConnectionFilter());
  
  await app.listen(3000);
}
bootstrap();
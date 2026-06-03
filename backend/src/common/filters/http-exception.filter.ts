import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'object' && body !== null && 'message' in body
        ? (body as any).message
        : exception.message;

    } else if (exception instanceof EntityNotFoundError) {
      status  = HttpStatus.NOT_FOUND;
      message = 'Resource not found';

    } else if (exception instanceof QueryFailedError) {
      const pg = exception as any;
      if (pg.code === '23505') {
        status  = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
      } else {
        this.logger.error('QueryFailedError', pg.message);
      }

    } else {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { EmailAlreadyExistsError } from '../../auth/errors/email-already-exists.error';
import { DatabaseUnavailableError } from '../../auth/errors/database-unavailable.error';
import { InvalidCredentialsError } from '../../auth/errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from '../../auth/errors/invalid-refresh-token.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return response.status(status).json(exception.getResponse());
    }

    if (exception instanceof EmailAlreadyExistsError) {
      return response.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: exception.message });
    }

    if (exception instanceof DatabaseUnavailableError) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ statusCode: 503, message: exception.message });
    }

    if (exception instanceof InvalidCredentialsError || exception instanceof InvalidRefreshTokenError) {
      return response.status(HttpStatus.UNAUTHORIZED).json({ statusCode: 401, message: exception.message });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}

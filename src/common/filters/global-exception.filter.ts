import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

import { DatabaseUnavailableError } from '../../auth/errors/database-unavailable.error';
import { EmailAlreadyExistsError } from '../../auth/errors/email-already-exists.error';
import { InvalidCredentialsError } from '../../auth/errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from '../../auth/errors/invalid-refresh-token.error';

import { ForbiddenOrderTransitionError } from '../../orders/errors/forbidden-order-transition.error';
import { InvalidOrderTransitionError } from '../../orders/errors/invalid-order-transition.error';
import { MixedCurrencyOrderError } from '../../orders/errors/mixed-currency-order.error';
import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';
import { OrderStateConflictError } from '../../orders/errors/order-state-conflict.error';

import { InactiveProductError } from '../../catalog/errors/inactive-product.error';
import { ProductNotFoundError } from '../../catalog/errors/product-not-found.error';

import { InsufficientStockError } from '../../inventory/errors/insufficient-stock.error';
import { InventoryNotFoundError } from '../../inventory/errors/inventory-not-found.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      return response.status(status).json(exception.getResponse());
    }

    if (
      exception instanceof InvalidCredentialsError ||
      exception instanceof InvalidRefreshTokenError
    ) {
      return response.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: exception.message,
      });
    }

    if (exception instanceof ForbiddenOrderTransitionError) {
      return response.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        message: exception.message,
      });
    }

    if (
      exception instanceof OrderNotFoundError ||
      exception instanceof ProductNotFoundError ||
      exception instanceof InventoryNotFoundError
    ) {
      return response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: exception.message,
      });
    }

    if (exception instanceof MixedCurrencyOrderError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message,
      });
    }

    if (
      exception instanceof EmailAlreadyExistsError ||
      exception instanceof InvalidOrderTransitionError ||
      exception instanceof OrderStateConflictError ||
      exception instanceof InactiveProductError ||
      exception instanceof InsufficientStockError
    ) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: exception.message,
      });
    }

    if (exception instanceof DatabaseUnavailableError) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: exception.message,
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}

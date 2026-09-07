import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import type { Response } from 'express';

import { DatabaseUnavailableError } from '../../auth/errors/database-unavailable.error';
import { EmailAlreadyExistsError } from '../../auth/errors/email-already-exists.error';
import { InvalidCredentialsError } from '../../auth/errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from '../../auth/errors/invalid-refresh-token.error';

import { ForbiddenOrderAccessError } from '../../orders/errors/forbidden-order-access.error';
import { ForbiddenOrderTransitionError } from '../../orders/errors/forbidden-order-transition.error';
import { InvalidOrderTransitionError } from '../../orders/errors/invalid-order-transition.error';
import { MixedCurrencyOrderError } from '../../orders/errors/mixed-currency-order.error';
import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';
import { OrderNotPayableError } from '../../orders/errors/order-not-payable.error';
import { OrderStateConflictError } from '../../orders/errors/order-state-conflict.error';

import { InactiveProductError } from '../../catalog/errors/inactive-product.error';
import { ProductNotFoundError } from '../../catalog/errors/product-not-found.error';

import { InsufficientStockError } from '../../inventory/errors/insufficient-stock.error';
import { InventoryNotFoundError } from '../../inventory/errors/inventory-not-found.error';
import { InventoryReleaseConflictError } from '../../inventory/errors/inventory-release-conflict.error';

import { InvalidPaymentWebhookError } from '../../payments/errors/invalid-payment-webhook.error';
import { PaymentCheckoutNotAllowedError } from '../../payments/errors/payment-checkout-not-allowed.error';
import { PaymentProviderError } from '../../payments/errors/payment-provider.error';
import { PaymentStateConflictError } from '../../payments/errors/payment-state-conflict.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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

    if (
      exception instanceof ForbiddenOrderTransitionError ||
      exception instanceof ForbiddenOrderAccessError
    ) {
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

    if (
      exception instanceof MixedCurrencyOrderError ||
      exception instanceof InvalidPaymentWebhookError
    ) {
      if (exception instanceof InvalidPaymentWebhookError) {
        const cause = exception.cause;

        if (cause instanceof Error) {
          this.logger.warn(`${exception.message}: ${cause.message}`);
        }
      }

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
      exception instanceof InsufficientStockError ||
      exception instanceof InventoryReleaseConflictError ||
      exception instanceof OrderNotPayableError ||
      exception instanceof PaymentCheckoutNotAllowedError ||
      exception instanceof PaymentStateConflictError
    ) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: exception.message,
      });
    }

    if (
      exception instanceof DatabaseUnavailableError ||
      exception instanceof PaymentProviderError
    ) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: exception.message,
      });
    }

    if (exception instanceof Error) {
      const cause = exception.cause;

      if (cause instanceof Error) {
        this.logger.error(
          `${exception.message}: ${cause.message}`,
          cause.stack ?? exception.stack
        );
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else {
      this.logger.error('Unknown non-Error exception');
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}

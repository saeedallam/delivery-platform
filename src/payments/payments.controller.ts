import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

import { StartPaymentCheckoutUseCase } from './application/start-payment-checkout.use-case';
import { HandlePaymentWebhookUseCase } from './application/handle-payment-webhook.use-case';
import { InvalidPaymentWebhookError } from './errors/invalid-payment-webhook.error';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly startPaymentCheckoutUseCase: StartPaymentCheckoutUseCase,

    private readonly handlePaymentWebhookUseCase: HandlePaymentWebhookUseCase
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post(':orderId/checkout')
  async startCheckout(
    @Param('orderId') orderId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.startPaymentCheckoutUseCase.execute({
      orderId,
      userId: request.user.userId,
    });
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string
  ) {
    const rawBody = request.rawBody;

    if (!rawBody || !signature) {
      throw new InvalidPaymentWebhookError();
    }

    await this.handlePaymentWebhookUseCase.execute(rawBody, signature);

    return {
      received: true,
    };
  }
}

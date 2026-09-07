import { Inject, Injectable } from '@nestjs/common';

import { OrdersService } from '../../orders/orders.service';

import { PaymentRepository } from '../payment.repository';
import { PAYMENT_GATEWAY } from '../gateways/payment-gateway.interface';
import type { PaymentGateway } from '../gateways/payment-gateway.interface';
import { PaymentCheckoutNotAllowedError } from '../errors/payment-checkout-not-allowed.error';
import { PaymentStatus } from 'generated/prisma/enums';
import {
  StartPaymentCheckoutData,
  StartPaymentCheckoutResult,
} from '../contracts/start-payment-checkout.interface';

@Injectable()
export class StartPaymentCheckoutUseCase {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentRepository: PaymentRepository,

    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGateway
  ) {}

  async execute(
    data: StartPaymentCheckoutData
  ): Promise<StartPaymentCheckoutResult> {
    const order = await this.ordersService.getOrderForPayment(
      data.orderId,
      data.userId
    );

    const payment = await this.paymentRepository.findOrCreateForOrder({
      orderId: order.id,
      userId: order.userId,
      amountInMinorUnits: order.totalAmountInMinorUnits,
      currency: order.currency,
    });

    const checkoutAllowed =
      payment.status === PaymentStatus.PENDING ||
      payment.status === PaymentStatus.PROCESSING;

    if (!checkoutAllowed) {
      throw new PaymentCheckoutNotAllowedError(payment.id, payment.status);
    }

    const checkoutSession = await this.paymentGateway.createCheckoutSession({
      paymentId: payment.id,
      orderId: order.id,
      amountInMinorUnits: order.totalAmountInMinorUnits,
      currency: order.currency,
    });

    const updatedPayment = await this.paymentRepository.attachCheckoutSession(
      payment.id,
      checkoutSession.providerSessionId,
      checkoutSession.expiresAt
    );

    return {
      paymentId: updatedPayment.id,
      checkoutUrl: checkoutSession.checkoutUrl,
      expiresAt: updatedPayment.expiresAt,
    };
  }
}

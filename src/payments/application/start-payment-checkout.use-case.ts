import { Inject, Injectable } from '@nestjs/common';

import { OrdersService } from '../../orders/orders.service';

import { PaymentRepository } from '../payment.repository';
import { PAYMENT_GATEWAY } from '../gateways/payment-gateway.interface';
import type { PaymentGateway } from '../gateways/payment-gateway.interface';

@Injectable()
export class StartPaymentCheckoutUseCase {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentRepository: PaymentRepository,

    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGateway
  ) {}
}

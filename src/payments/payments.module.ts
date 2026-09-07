import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';

import { PaymentsController } from './payments.controller';

import { PaymentRepository } from './payment.repository';

import { StartPaymentCheckoutUseCase } from './application/start-payment-checkout.use-case';
import { HandlePaymentWebhookUseCase } from './application/handle-payment-webhook.use-case';

import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { StripePaymentGateway } from './gateways/stripe-payment.gateway';
import { InventoryModule } from 'src/inventory/inventory.module';

@Module({
  imports: [PrismaModule, OrdersModule, InventoryModule],

  controllers: [PaymentsController],

  providers: [
    PaymentRepository,
    StripePaymentGateway,
    StartPaymentCheckoutUseCase,
    HandlePaymentWebhookUseCase,
    {
      provide: PAYMENT_GATEWAY,
      useExisting: StripePaymentGateway,
    },
  ],

  exports: [PaymentRepository, PAYMENT_GATEWAY],
})
export class PaymentsModule {}

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { PaymentRepository } from './payment.repository';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { StripePaymentGateway } from './gateways/stripe-payment.gateway';

@Module({
  imports: [PrismaModule],

  providers: [
    PaymentRepository,
    StripePaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      useExisting: StripePaymentGateway,
    },
  ],

  exports: [PaymentRepository, PAYMENT_GATEWAY],
})
export class PaymentsModule {}

import { Injectable } from '@nestjs/common';

import { Currency } from '../catalog/contracts/currency.enum';
import { PrismaService } from '../prisma/prisma.service';

import { CreatePaymentData } from './contracts/create-payment-data.interface';
import { PaymentStatus } from './contracts/payment-status.enum';
import { Payment } from './domain/payment.interface';
import { PaymentMappingError } from './errors/payment-mapping.error';
import { PaymentStateConflictError } from './errors/payment-state-conflict.error';

interface PaymentPersistenceRecord {
  id: string;
  orderId: string;
  userId: string;
  amountInMinorUnits: number;
  currency: string;
  status: string;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateForOrder(data: CreatePaymentData): Promise<Payment> {
    const payment = await this.prisma.payment.upsert({
      where: {
        orderId: data.orderId,
      },

      create: {
        orderId: data.orderId,
        userId: data.userId,
        amountInMinorUnits: data.amountInMinorUnits,
        currency: data.currency,
      },

      update: {},
    });

    return this.mapToPayment(payment);
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: {
        orderId,
      },
    });

    return payment ? this.mapToPayment(payment) : null;
  }

  async attachCheckoutSession(
    paymentId: string,
    providerSessionId: string,
    expiresAt: Date | null
  ): Promise<Payment> {
    const result = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
      },
      data: {
        providerSessionId,
        expiresAt,
        status: PaymentStatus.PROCESSING,
      },
    });

    if (result.count !== 1) {
      throw new PaymentStateConflictError(paymentId, PaymentStatus.PENDING);
    }

    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new PaymentStateConflictError(paymentId, PaymentStatus.PENDING);
    }

    return this.mapToPayment(payment);
  }

  private mapToPayment(payment: PaymentPersistenceRecord): Payment {
    const status = Object.values(PaymentStatus).find(
      (value) => value === payment.status
    );

    const currency = Object.values(Currency).find(
      (value) => value === payment.currency
    );

    if (!status || !currency) {
      throw new PaymentMappingError(payment.status, payment.currency);
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amountInMinorUnits: payment.amountInMinorUnits,
      currency,
      status,
      providerSessionId: payment.providerSessionId,
      providerPaymentId: payment.providerPaymentId,
      failureReason: payment.failureReason,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

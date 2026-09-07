import { Injectable } from '@nestjs/common';

import { Currency } from '../catalog/contracts/currency.enum';
import { PrismaService } from '../prisma/prisma.service';

import { CreatePaymentData } from './contracts/create-payment-data.interface';
import { PaymentStatus } from './contracts/payment-status.enum';
import { Payment } from './domain/payment.interface';
import { PaymentMappingError } from './errors/payment-mapping.error';
import { PaymentStateConflictError } from './errors/payment-state-conflict.error';
import { MarkPaymentSucceededData } from './contracts/mark-payment-succeeded-data.interface';
import {
  MarkPaymentExpiredData,
  MarkPaymentExpiredResult,
} from './contracts/mark-payment-expired-data.interface';
import { Prisma } from 'generated/prisma/client';

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

        OR: [
          {
            status: PaymentStatus.PENDING,
            providerSessionId: null,
          },
          {
            status: PaymentStatus.PROCESSING,
            providerSessionId,
          },
        ],
      },

      data: {
        providerSessionId,
        expiresAt,
        status: PaymentStatus.PROCESSING,
      },
    });

    if (result.count !== 1) {
      throw new PaymentStateConflictError(paymentId);
    }

    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new PaymentStateConflictError(paymentId);
    }

    return this.mapToPayment(payment);
  }

  async markSucceeded(data: MarkPaymentSucceededData): Promise<Payment> {
    const result = await this.prisma.payment.updateMany({
      where: {
        id: data.paymentId,
        amountInMinorUnits: data.amountInMinorUnits,
        currency: data.currency,

        OR: [
          {
            status: PaymentStatus.PROCESSING,
            providerSessionId: data.providerSessionId,
            providerPaymentId: null,
          },
          {
            status: PaymentStatus.SUCCEEDED,
            providerSessionId: data.providerSessionId,
            providerPaymentId: data.providerPaymentId,
          },
        ],
      },

      data: {
        status: PaymentStatus.SUCCEEDED,
        providerPaymentId: data.providerPaymentId,
        paidAt: data.paidAt,
        failureReason: null,
      },
    });

    if (result.count !== 1) {
      throw new PaymentStateConflictError(data.paymentId);
    }

    const payment = await this.prisma.payment.findUnique({
      where: {
        id: data.paymentId,
      },
    });

    if (!payment) {
      throw new PaymentStateConflictError(data.paymentId);
    }

    return this.mapToPayment(payment);
  }

  async markExpired(
    data: MarkPaymentExpiredData,
    tx?: Prisma.TransactionClient
  ): Promise<MarkPaymentExpiredResult> {
    const client = tx ?? this.prisma;

    const result = await client.payment.updateMany({
      where: {
        id: data.paymentId,
        status: PaymentStatus.PROCESSING,
        providerSessionId: data.providerSessionId,
        providerPaymentId: null,
        amountInMinorUnits: data.amountInMinorUnits,
        currency: data.currency,
      },

      data: {
        status: PaymentStatus.EXPIRED,
        failureReason: 'Stripe Checkout Session expired',
      },
    });

    const payment = await client.payment.findUnique({
      where: {
        id: data.paymentId,
      },
    });

    if (!payment) {
      throw new PaymentStateConflictError(data.paymentId);
    }

    if (result.count === 1) {
      return {
        payment: this.mapToPayment(payment),
        transitioned: true,
      };
    }

    const isSameExpiredPayment =
      payment.status === PaymentStatus.EXPIRED &&
      payment.providerSessionId === data.providerSessionId &&
      payment.providerPaymentId === null &&
      payment.amountInMinorUnits === data.amountInMinorUnits &&
      payment.currency === data.currency;

    if (!isSameExpiredPayment) {
      throw new PaymentStateConflictError(data.paymentId);
    }

    return {
      payment: this.mapToPayment(payment),
      transitioned: false,
    };
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

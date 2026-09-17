import { Inject, Injectable } from '@nestjs/common';
import { OrderStatus } from 'generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from '../../orders/order.repository';
import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';
import { InventoryRepository } from '../../inventory/inventory.repository';
import { InventoryService } from '../../inventory/inventory.service';

import { PaymentRepository } from '../payment.repository';
import { PAYMENT_GATEWAY } from '../gateways/payment-gateway.interface';
import type { PaymentGateway } from '../gateways/payment-gateway.interface';

@Injectable()
export class HandlePaymentWebhookUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService,

    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGateway
  ) {}

  async execute(rawBody: Buffer, signature: string): Promise<void> {
    const event = this.paymentGateway.verifyAndParseWebhookEvent(
      rawBody,
      signature
    );

    if (event.type === 'IGNORED') {
      return;
    }

    if (event.type === 'PAYMENT_SUCCEEDED') {
      await this.prisma.$transaction(async (tx) => {
        const payment = await this.paymentRepository.markSucceeded(
          {
            paymentId: event.paymentId,
            providerSessionId: event.providerSessionId,
            providerPaymentId: event.providerPaymentId,
            amountInMinorUnits: event.amountInMinorUnits,
            currency: event.currency,
            paidAt: event.occurredAt,
          },
          tx
        );

        const order = await this.orderRepository.findById(payment.orderId, tx);

        if (!order) {
          throw new OrderNotFoundError(payment.orderId);
        }

        if (order.status === OrderStatus.PENDING) {
          await this.orderRepository.updateStatus(
            order.id,
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            tx
          );
        }
      });

      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const expirationResult = await this.paymentRepository.markExpired(
        {
          paymentId: event.paymentId,
          providerSessionId: event.providerSessionId,
          amountInMinorUnits: event.amountInMinorUnits,
          currency: event.currency,
        },
        tx
      );

      if (!expirationResult.transitioned) {
        return;
      }

      const order = await this.orderRepository.findById(
        expirationResult.payment.orderId,
        tx
      );

      if (!order) {
        throw new OrderNotFoundError(expirationResult.payment.orderId);
      }

      for (const item of order.items) {
        const releasedInventory = await this.inventoryRepository.releaseStock(
          item.productId,
          item.quantity,
          tx
        );

        const existingInventory = releasedInventory
          ? null
          : await this.inventoryRepository.findByProductId(item.productId, tx);

        this.inventoryService.interpretReleaseResult(
          item.productId,
          item.quantity,
          releasedInventory !== null,
          existingInventory
        );
      }
    });
  }
}

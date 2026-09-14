import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';

import { OrderStatus } from 'generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from '../../orders/order.repository';

import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';
import { OrderStateConflictError } from '../../orders/errors/order-state-conflict.error';

import { DeliveryRepository } from '../delivery.repository';
import type { Delivery } from '../domain/delivery.interface';

import { DELIVERY_COMPLETED_EVENT } from '../contracts/delivery-completed-event.interface';
import type { DeliveryCompletedEvent } from '../contracts/delivery-completed-event.interface';

import { DeliveryNotFoundError } from '../errors/delivery-not-found.error';
import { ForbiddenDeliveryAccessError } from '../errors/forbidden-delivery-access.error';

@Injectable()
export class CompleteDeliveryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryRepository: DeliveryRepository,
    private readonly orderRepository: OrderRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(deliveryId: string, driverId: string): Promise<Delivery> {
    const { delivery, event } = await this.prisma.$transaction(async (tx) => {
      const delivery = await this.deliveryRepository.findById(deliveryId, tx);

      if (!delivery) {
        throw new DeliveryNotFoundError(deliveryId);
      }

      if (delivery.driverId !== driverId) {
        throw new ForbiddenDeliveryAccessError(deliveryId);
      }

      const order = await this.orderRepository.findById(delivery.orderId, tx);

      if (!order) {
        throw new OrderNotFoundError(delivery.orderId);
      }

      if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
        throw new OrderStateConflictError(
          order.id,
          OrderStatus.OUT_FOR_DELIVERY
        );
      }

      const completedDelivery = await this.deliveryRepository.markDelivered(
        deliveryId,
        driverId,
        tx
      );

      await this.orderRepository.updateStatus(
        order.id,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        tx
      );

      if (!completedDelivery.deliveredAt) {
        throw new Error('Completed delivery is missing deliveredAt');
      }

      const event: DeliveryCompletedEvent = {
        eventId: randomUUID(),
        deliveryId: completedDelivery.id,
        orderId: order.id,
        userId: order.userId,
        occurredAt: completedDelivery.deliveredAt,
      };

      return {
        delivery: completedDelivery,
        event,
      };
    });

    this.eventEmitter.emit(DELIVERY_COMPLETED_EVENT, event);

    return delivery;
  }
}

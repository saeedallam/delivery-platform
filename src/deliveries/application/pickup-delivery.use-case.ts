import { Injectable } from '@nestjs/common';
import { OrderStatus } from 'generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from '../../orders/order.repository';
import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';

import { DeliveryRepository } from '../delivery.repository';
import type { Delivery } from '../domain/delivery.interface';

import { DeliveryNotFoundError } from '../errors/delivery-not-found.error';
import { ForbiddenDeliveryAccessError } from '../errors/forbidden-delivery-access.error';
import { OrderNotReadyForDeliveryError } from '../errors/order-not-ready-for-delivery.error';

@Injectable()
export class PickupDeliveryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryRepository: DeliveryRepository,
    private readonly orderRepository: OrderRepository
  ) {}

  async execute(deliveryId: string, driverId: string): Promise<Delivery> {
    return this.prisma.$transaction(async (tx) => {
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

      if (order.status !== OrderStatus.PREPARING) {
        throw new OrderNotReadyForDeliveryError(order.id, order.status);
      }

      const pickedUpDelivery = await this.deliveryRepository.markPickedUp(
        deliveryId,
        driverId,
        tx
      );

      await this.orderRepository.updateStatus(
        order.id,
        OrderStatus.PREPARING,
        OrderStatus.OUT_FOR_DELIVERY,
        tx
      );

      return pickedUpDelivery;
    });
  }
}

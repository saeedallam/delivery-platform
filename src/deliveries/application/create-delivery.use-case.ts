import { Injectable } from '@nestjs/common';
import { OrderStatus } from 'generated/prisma/enums';

import { OrderRepository } from '../../orders/order.repository';
import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';

import { DeliveryRepository } from '../delivery.repository';
import type { Delivery } from '../domain/delivery.interface';
import { OrderNotReadyForDeliveryError } from '../errors/order-not-ready-for-delivery.error';

@Injectable()
export class CreateDeliveryUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly deliveryRepository: DeliveryRepository
  ) {}

  async execute(orderId: string): Promise<Delivery> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status !== OrderStatus.PREPARING) {
      throw new OrderNotReadyForDeliveryError(orderId, order.status);
    }

    return this.deliveryRepository.createForOrder({
      orderId,
    });
  }
}

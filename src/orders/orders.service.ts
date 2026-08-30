import { Injectable } from '@nestjs/common';

import { OrderStatus } from '../../generated/prisma/enums';
import { UserRole } from '../auth/contracts/user-role.enum';

import {
  CreateOrderData,
  CreateOrderItemData,
} from './contracts/create-order-data.interface';

import { PersistOrderData } from './contracts/persist-order-data.interface';

import { OrderRepository } from './order.repository';

import { InvalidOrderTransitionError } from './errors/invalid-order-transition.error';
import { ForbiddenOrderTransitionError } from './errors/forbidden-order-transition.error';
import { OrderNotFoundError } from './errors/order-not-found.error';

export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],

  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],

  [OrderStatus.PREPARING]: [OrderStatus.OUT_FOR_DELIVERY],

  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],

  [OrderStatus.DELIVERED]: [],

  [OrderStatus.CANCELLED]: [],
};

const transitionActors: Partial<
  Record<OrderStatus, Partial<Record<OrderStatus, UserRole>>>
> = {
  [OrderStatus.PENDING]: {
    [OrderStatus.CONFIRMED]: UserRole.MERCHANT,
    [OrderStatus.CANCELLED]: UserRole.CUSTOMER,
  },

  [OrderStatus.CONFIRMED]: {
    [OrderStatus.PREPARING]: UserRole.MERCHANT,
    [OrderStatus.CANCELLED]: UserRole.CUSTOMER,
  },

  [OrderStatus.PREPARING]: {
    [OrderStatus.OUT_FOR_DELIVERY]: UserRole.MERCHANT,
  },

  [OrderStatus.OUT_FOR_DELIVERY]: {
    [OrderStatus.DELIVERED]: UserRole.DRIVER,
  },
};

@Injectable()
export class OrdersService {
  constructor(private readonly orderRepository: OrderRepository) {}

  canTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
    return allowedTransitions[currentStatus].includes(nextStatus);
  }

  canActorTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
    actorRole: UserRole
  ): boolean {
    return transitionActors[currentStatus]?.[nextStatus] === actorRole;
  }

  transitionOrder(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
    actorRole: UserRole
  ): OrderStatus {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new InvalidOrderTransitionError(currentStatus, nextStatus);
    }

    if (!this.canActorTransition(currentStatus, nextStatus, actorRole)) {
      throw new ForbiddenOrderTransitionError(
        currentStatus,
        nextStatus,
        actorRole
      );
    }

    return nextStatus;
  }

  async createOrder(data: CreateOrderData) {
    const totalAmountInMinorUnits = this.calculateTotal(data.items);

    const orderData: PersistOrderData = {
      ...data,
      totalAmountInMinorUnits,
    };

    return this.orderRepository.createOrder(orderData);
  }

  private calculateTotal(items: CreateOrderItemData[]): number {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceInMinorUnits,
      0
    );
  }

  async changeStatus(
    orderId: string,
    nextStatus: OrderStatus,
    actorRole: UserRole
  ) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    const newStatus = this.transitionOrder(order.status, nextStatus, actorRole);

    return this.orderRepository.updateStatus(orderId, order.status, newStatus);
  }
}

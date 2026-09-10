import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../../generated/prisma/enums';

import { UserRole } from '../auth/contracts/user-role.enum';

import { CreateOrderData } from './contracts/create-order-data.interface';
import { PersistOrderData } from './contracts/persist-order-data.interface';
import { OrderPaymentDetails } from './contracts/order-payment-details.interface';

import { OrderRepository } from './order.repository';

import { InvalidOrderTransitionError } from './errors/invalid-order-transition.error';
import { ForbiddenOrderTransitionError } from './errors/forbidden-order-transition.error';
import { OrderNotFoundError } from './errors/order-not-found.error';
import { MixedCurrencyOrderError } from './errors/mixed-currency-order.error';
import { ForbiddenOrderAccessError } from './errors/forbidden-order-access.error';
import { OrderNotPayableError } from './errors/order-not-payable.error';
import { OrderMappingError } from './errors/order-mapping.error';

import { ProductsService } from 'src/catalog/products.service';
import { Currency } from 'src/catalog/contracts/currency.enum';

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
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productsService: ProductsService
  ) {}

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

  async prepareOrderData(data: CreateOrderData): Promise<PersistOrderData> {
    const products = await Promise.all(
      data.items.map((item) =>
        this.productsService.getProductForOrder(item.productId)
      )
    );

    const currency = this.validateCurrency(products);

    const trustedItems = data.items.map((item, index) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceInMinorUnits: products[index].priceInMinorUnits,
    }));

    const totalAmountInMinorUnits = this.calculateTotal(trustedItems);

    return {
      userId: data.userId,
      currency,
      items: trustedItems,
      totalAmountInMinorUnits,
    };
  }

  async getOrderForPayment(
    orderId: string,
    userId: string
  ): Promise<OrderPaymentDetails> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.userId !== userId) {
      throw new ForbiddenOrderAccessError(orderId);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new OrderNotPayableError(orderId, order.status);
    }

    const currency = Object.values(Currency).find(
      (value) => value === order.currency
    );

    if (!currency) {
      throw new OrderMappingError(orderId, order.currency);
    }

    return {
      id: order.id,
      userId: order.userId,
      totalAmountInMinorUnits: order.totalAmountInMinorUnits,
      currency,
    };
  }

  private calculateTotal(
    items: {
      productId: string;
      quantity: number;
      unitPriceInMinorUnits: number;
    }[]
  ): number {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceInMinorUnits,
      0
    );
  }

  private validateCurrency(
    products: {
      currency: Currency;
    }[]
  ): Currency {
    const currency = products[0].currency;

    const hasMixedCurrencies = products.some(
      (product) => product.currency !== currency
    );

    if (hasMixedCurrencies) {
      throw new MixedCurrencyOrderError();
    }

    return currency;
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

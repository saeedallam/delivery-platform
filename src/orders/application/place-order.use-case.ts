import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryRepository } from '../../inventory/inventory.repository';
import { InventoryService } from '../../inventory/inventory.service';

import { OrdersService } from '../orders.service';
import { OrderRepository } from '../order.repository';
import { CreateOrderData } from '../contracts/create-order-data.interface';

@Injectable()
export class PlaceOrderUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly orderRepository: OrderRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryService: InventoryService
  ) {}

  async execute(data: CreateOrderData) {
    const orderData = await this.ordersService.prepareOrderData(data);

    return this.prisma.$transaction(async (tx) => {
      for (const item of orderData.items) {
        const reservation = await this.inventoryRepository.reserveStock(
          item.productId,
          item.quantity,
          tx
        );

        const existingInventory = reservation
          ? null
          : await this.inventoryRepository.findByProductId(item.productId, tx);

        this.inventoryService.interpretReservationResult(
          item.productId,
          item.quantity,
          reservation !== null,
          existingInventory
        );
      }

      return this.orderRepository.createOrder(orderData, tx);
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { PersistOrderData } from './contracts/persist-order-data.interface';
import { OrderStatus } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { OrderStateConflictError } from './errors/order-state-conflict.error';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(data: PersistOrderData, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const order = await client.order.create({
      data: {
        userId: data.userId,
        totalAmountInMinorUnits: data.totalAmountInMinorUnits,
        currency: data.currency,

        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceInMinorUnits: item.unitPriceInMinorUnits,
          })),
        },
      },

      include: {
        items: true,
      },
    });

    return order;
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },

      include: {
        items: true,
      },
    });
  }

  async updateStatus(
    id: string,
    currentStatus: OrderStatus,
    newStatus: OrderStatus
  ) {
    const result = await this.prisma.order.updateMany({
      where: {
        id,
        status: currentStatus,
      },
      data: {
        status: newStatus,
      },
    });

    if (result.count !== 1) {
      throw new OrderStateConflictError(id, currentStatus);
    }

    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateDeliveryData } from './contracts/create-delivery-data.interface';
import { DeliveryStatus } from './contracts/delivery-status.enum';
import { Delivery } from './domain/delivery.interface';

import { DeliveryAlreadyExistsError } from './errors/delivery-already-exists.error';
import { DeliveryMappingError } from './errors/delivery-mapping.error';
import { DeliveryStateConflictError } from './errors/delivery-state-conflict.error';

interface DeliveryPersistenceRecord {
  id: string;
  orderId: string;
  driverId: string | null;
  status: string;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createForOrder(data: CreateDeliveryData): Promise<Delivery> {
    try {
      const delivery = await this.prisma.delivery.create({
        data: {
          orderId: data.orderId,
        },
      });

      return this.mapToDelivery(delivery);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DeliveryAlreadyExistsError(data.orderId);
      }

      throw error;
    }
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<Delivery | null> {
    const client = tx ?? this.prisma;

    const delivery = await client.delivery.findUnique({
      where: { id },
    });

    return delivery ? this.mapToDelivery(delivery) : null;
  }

  async assignDriver(deliveryId: string, driverId: string): Promise<Delivery> {
    const result = await this.prisma.delivery.updateMany({
      where: {
        id: deliveryId,
        status: DeliveryStatus.PENDING_ASSIGNMENT,
        driverId: null,
      },
      data: {
        driverId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new DeliveryStateConflictError(deliveryId);
    }

    const delivery = await this.findById(deliveryId);

    if (!delivery) {
      throw new DeliveryStateConflictError(deliveryId);
    }

    return delivery;
  }

  async markPickedUp(
    deliveryId: string,
    driverId: string,
    tx: Prisma.TransactionClient
  ): Promise<Delivery> {
    const result = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        driverId,
        status: DeliveryStatus.ASSIGNED,
      },
      data: {
        status: DeliveryStatus.PICKED_UP,
        pickedUpAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new DeliveryStateConflictError(deliveryId);
    }

    const delivery = await this.findById(deliveryId, tx);

    if (!delivery) {
      throw new DeliveryStateConflictError(deliveryId);
    }

    return delivery;
  }

  async markDelivered(
    deliveryId: string,
    driverId: string,
    tx: Prisma.TransactionClient
  ): Promise<Delivery> {
    const result = await tx.delivery.updateMany({
      where: {
        id: deliveryId,
        driverId,
        status: DeliveryStatus.PICKED_UP,
      },
      data: {
        status: DeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new DeliveryStateConflictError(deliveryId);
    }

    const delivery = await this.findById(deliveryId, tx);

    if (!delivery) {
      throw new DeliveryStateConflictError(deliveryId);
    }

    return delivery;
  }

  private mapToDelivery(delivery: DeliveryPersistenceRecord): Delivery {
    const status = Object.values(DeliveryStatus).find(
      (value) => value === delivery.status
    );

    if (!status) {
      throw new DeliveryMappingError(delivery.status);
    }

    return {
      id: delivery.id,
      orderId: delivery.orderId,
      driverId: delivery.driverId,
      status,
      assignedAt: delivery.assignedAt,
      pickedUpAt: delivery.pickedUpAt,
      deliveredAt: delivery.deliveredAt,
      cancelledAt: delivery.cancelledAt,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }
}

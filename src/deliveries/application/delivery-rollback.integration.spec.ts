import { randomUUID } from 'node:crypto';

import { OrderStatus } from 'generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';
import { OrderRepository } from '../../orders/order.repository';

import { DeliveryRepository } from '../delivery.repository';
import { DeliveryStatus } from '../contracts/delivery-status.enum';

import { PickupDeliveryUseCase } from './pickup-delivery.use-case';

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

const describeIntegration = runIntegrationTests ? describe : describe.skip;

describeIntegration('Delivery transaction rollback', () => {
  let prisma: PrismaService | undefined;

  const orderId = randomUUID();
  const deliveryId = randomUUID();
  const driverId = randomUUID();
  const userId = randomUUID();

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    const parsedUrl = new URL(databaseUrl);

    if (parsedUrl.pathname !== '/delivery_test_db') {
      throw new Error('Integration tests must use delivery_test_db');
    }

    prisma = new PrismaService();
    await prisma.$connect();

    const databases = await prisma.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;

    if (databases[0]?.name !== 'delivery_test_db') {
      await prisma.$disconnect();
      prisma = undefined;

      throw new Error('Connected database is not delivery_test_db');
    }
  }, 30000);

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    try {
      await prisma.delivery.deleteMany({
        where: { id: deliveryId },
      });

      await prisma.order.deleteMany({
        where: { id: orderId },
      });
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('rolls back pickup when the order update fails', async () => {
    if (!prisma) {
      throw new Error('Test database connection was not initialized');
    }

    await prisma.order.create({
      data: {
        id: orderId,
        userId,
        status: OrderStatus.PREPARING,
        totalAmountInMinorUnits: 1000,
        currency: 'USD',
      },
    });

    const originalDelivery = await prisma.delivery.create({
      data: {
        id: deliveryId,
        orderId,
        driverId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });

    const orderRepository = new OrderRepository(prisma);
    const deliveryRepository = new DeliveryRepository(prisma);

    const useCase = new PickupDeliveryUseCase(
      prisma,
      deliveryRepository,
      orderRepository
    );

    const simulatedFailure = new Error('Simulated order update failure');

    let deliveryWasUpdatedInsideTransaction = false;

    const updateStatusSpy = jest
      .spyOn(orderRepository, 'updateStatus')
      .mockImplementation(async (_id, _currentStatus, _newStatus, tx) => {
        if (!tx) {
          throw new Error('Expected a transaction client');
        }

        const deliveryInsideTransaction = await tx.delivery.findUnique({
          where: { id: deliveryId },
        });

        expect(deliveryInsideTransaction?.status).toBe(
          DeliveryStatus.PICKED_UP
        );

        expect(deliveryInsideTransaction?.pickedUpAt).toBeInstanceOf(Date);

        deliveryWasUpdatedInsideTransaction = true;

        throw simulatedFailure;
      });

    try {
      await expect(useCase.execute(deliveryId, driverId)).rejects.toBe(
        simulatedFailure
      );

      expect(deliveryWasUpdatedInsideTransaction).toBe(true);
      expect(updateStatusSpy).toHaveBeenCalledTimes(1);

      const deliveryAfterRollback = await prisma.delivery.findUnique({
        where: { id: deliveryId },
      });

      const orderAfterRollback = await prisma.order.findUnique({
        where: { id: orderId },
      });

      expect(deliveryAfterRollback).not.toBeNull();

      expect(deliveryAfterRollback?.status).toBe(DeliveryStatus.ASSIGNED);

      expect(deliveryAfterRollback?.pickedUpAt).toBeNull();

      expect(deliveryAfterRollback?.updatedAt).toEqual(
        originalDelivery.updatedAt
      );

      expect(orderAfterRollback?.status).toBe(OrderStatus.PREPARING);
    } finally {
      updateStatusSpy.mockRestore();
    }
  }, 30000);
});

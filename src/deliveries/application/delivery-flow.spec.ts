import { Test } from '@nestjs/testing';

import { OrderStatus } from 'generated/prisma/enums';

import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/contracts/user-role.enum';
import { PrismaService } from '../../prisma/prisma.service';

import { OrderRepository } from '../../orders/order.repository';
import { OrderNotFoundError } from '../../orders/errors/order-not-found.error';
import { OrderStateConflictError } from '../../orders/errors/order-state-conflict.error';

import { OutboxRepository } from '../../outbox/outbox.repository';
import type { CreateOutboxEventData } from '../../outbox/contracts/create-outbox-event-data.interface';

import { DeliveryRepository } from '../delivery.repository';
import { DeliveryStatus } from '../contracts/delivery-status.enum';
import { DELIVERY_COMPLETED_EVENT } from '../contracts/delivery-completed-event.interface';

import { DeliveryAlreadyExistsError } from '../errors/delivery-already-exists.error';
import { DeliveryNotFoundError } from '../errors/delivery-not-found.error';
import { DeliveryStateConflictError } from '../errors/delivery-state-conflict.error';
import { DriverNotFoundError } from '../errors/driver-not-found.error';
import { ForbiddenDeliveryAccessError } from '../errors/forbidden-delivery-access.error';
import { InvalidDriverRoleError } from '../errors/invalid-driver-role.error';
import { OrderNotReadyForDeliveryError } from '../errors/order-not-ready-for-delivery.error';

import { CreateDeliveryUseCase } from './create-delivery.use-case';
import { AssignDriverUseCase } from './assign-driver.use-case';
import { PickupDeliveryUseCase } from './pickup-delivery.use-case';
import { CompleteDeliveryUseCase } from './complete-delivery.use-case';

describe('Delivery flow', () => {
  const deliveryId = 'delivery-1';
  const orderId = 'order-1';
  const driverId = 'driver-1';
  const userId = 'customer-1';

  const deliveredAt = new Date('2026-09-11T10:00:00.000Z');
  const transactionClient = {};

  let transactionCompleted: boolean;

  let createDelivery: CreateDeliveryUseCase;
  let assignDriver: AssignDriverUseCase;
  let pickupDelivery: PickupDeliveryUseCase;
  let completeDelivery: CompleteDeliveryUseCase;

  let prisma: {
    $transaction: jest.Mock;
  };

  let outboxRepository: {
    create: jest.Mock;
  };

  let authService: {
    getUserIdentity: jest.Mock;
  };

  let orderRepository: {
    findById: jest.Mock;
    updateStatus: jest.Mock;
  };

  let deliveryRepository: {
    findById: jest.Mock;
    createForOrder: jest.Mock;
    assignDriver: jest.Mock;
    markPickedUp: jest.Mock;
    markDelivered: jest.Mock;
  };

  beforeEach(async () => {
    transactionCompleted = false;

    prisma = {
      $transaction: jest.fn(
        async (
          callback: (tx: typeof transactionClient) => Promise<unknown>
        ) => {
          const result = await callback(transactionClient);

          transactionCompleted = true;

          return result;
        }
      ),
    };

    outboxRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    authService = {
      getUserIdentity: jest.fn().mockResolvedValue({
        id: driverId,
        role: UserRole.DRIVER,
      }),
    };

    orderRepository = {
      findById: jest.fn().mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.PREPARING,
      }),
      updateStatus: jest.fn().mockResolvedValue({
        id: orderId,
      }),
    };

    deliveryRepository = {
      findById: jest.fn().mockResolvedValue({
        id: deliveryId,
        orderId,
        driverId,
        status: DeliveryStatus.ASSIGNED,
      }),
      createForOrder: jest.fn(),
      assignDriver: jest.fn(),
      markPickedUp: jest.fn(),
      markDelivered: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateDeliveryUseCase,
        AssignDriverUseCase,
        PickupDeliveryUseCase,
        CompleteDeliveryUseCase,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: OutboxRepository,
          useValue: outboxRepository,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: OrderRepository,
          useValue: orderRepository,
        },
        {
          provide: DeliveryRepository,
          useValue: deliveryRepository,
        },
      ],
    }).compile();

    createDelivery = moduleRef.get(CreateDeliveryUseCase);
    assignDriver = moduleRef.get(AssignDriverUseCase);
    pickupDelivery = moduleRef.get(PickupDeliveryUseCase);
    completeDelivery = moduleRef.get(CompleteDeliveryUseCase);
  });

  describe('CreateDeliveryUseCase', () => {
    it('creates delivery for a preparing order', async () => {
      const created = {
        id: deliveryId,
        orderId,
        status: DeliveryStatus.PENDING_ASSIGNMENT,
      };

      deliveryRepository.createForOrder.mockResolvedValue(created);

      await expect(createDelivery.execute(orderId)).resolves.toBe(created);

      expect(orderRepository.findById).toHaveBeenCalledWith(orderId);

      expect(deliveryRepository.createForOrder).toHaveBeenCalledWith({
        orderId,
      });
    });

    it('rejects a missing order without creating delivery', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(createDelivery.execute(orderId)).rejects.toThrow(
        OrderNotFoundError
      );

      expect(deliveryRepository.createForOrder).not.toHaveBeenCalled();
    });

    it.each([
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ])('rejects order status %s', async (status) => {
      orderRepository.findById.mockResolvedValue({
        id: orderId,
        userId,
        status,
      });

      await expect(createDelivery.execute(orderId)).rejects.toThrow(
        OrderNotReadyForDeliveryError
      );

      expect(deliveryRepository.createForOrder).not.toHaveBeenCalled();
    });

    it('propagates the duplicate delivery error', async () => {
      const error = new DeliveryAlreadyExistsError(orderId);

      deliveryRepository.createForOrder.mockRejectedValue(error);

      await expect(createDelivery.execute(orderId)).rejects.toBe(error);
    });
  });

  describe('AssignDriverUseCase', () => {
    it('assigns an existing driver', async () => {
      const assigned = {
        id: deliveryId,
        driverId,
        status: DeliveryStatus.ASSIGNED,
      };

      deliveryRepository.assignDriver.mockResolvedValue(assigned);

      await expect(assignDriver.execute(deliveryId, driverId)).resolves.toBe(
        assigned
      );

      expect(authService.getUserIdentity).toHaveBeenCalledWith(driverId);

      expect(deliveryRepository.assignDriver).toHaveBeenCalledWith(
        deliveryId,
        driverId
      );
    });

    it('rejects a missing delivery', async () => {
      deliveryRepository.findById.mockResolvedValue(null);

      await expect(assignDriver.execute(deliveryId, driverId)).rejects.toThrow(
        DeliveryNotFoundError
      );

      expect(authService.getUserIdentity).not.toHaveBeenCalled();
      expect(deliveryRepository.assignDriver).not.toHaveBeenCalled();
    });

    it('rejects a missing driver', async () => {
      authService.getUserIdentity.mockResolvedValue(null);

      await expect(assignDriver.execute(deliveryId, driverId)).rejects.toThrow(
        DriverNotFoundError
      );

      expect(deliveryRepository.assignDriver).not.toHaveBeenCalled();
    });

    it.each([UserRole.CUSTOMER, UserRole.MERCHANT])(
      'rejects a user with role %s',
      async (role) => {
        authService.getUserIdentity.mockResolvedValue({
          id: driverId,
          role,
        });

        await expect(
          assignDriver.execute(deliveryId, driverId)
        ).rejects.toThrow(InvalidDriverRoleError);

        expect(deliveryRepository.assignDriver).not.toHaveBeenCalled();
      }
    );

    it('propagates an assignment conflict', async () => {
      const error = new DeliveryStateConflictError(deliveryId);

      deliveryRepository.assignDriver.mockRejectedValue(error);

      await expect(assignDriver.execute(deliveryId, driverId)).rejects.toBe(
        error
      );
    });
  });

  describe.each(['pickup', 'complete'] as const)('%s delivery', (operation) => {
    const expectedOrderStatus =
      operation === 'pickup'
        ? OrderStatus.PREPARING
        : OrderStatus.OUT_FOR_DELIVERY;

    const nextOrderStatus =
      operation === 'pickup'
        ? OrderStatus.OUT_FOR_DELIVERY
        : OrderStatus.DELIVERED;

    const initialDeliveryStatus =
      operation === 'pickup'
        ? DeliveryStatus.ASSIGNED
        : DeliveryStatus.PICKED_UP;

    const nextDeliveryStatus =
      operation === 'pickup'
        ? DeliveryStatus.PICKED_UP
        : DeliveryStatus.DELIVERED;

    function execute() {
      return operation === 'pickup'
        ? pickupDelivery.execute(deliveryId, driverId)
        : completeDelivery.execute(deliveryId, driverId);
    }

    function writeDelivery() {
      return operation === 'pickup'
        ? deliveryRepository.markPickedUp
        : deliveryRepository.markDelivered;
    }

    beforeEach(() => {
      orderRepository.findById.mockResolvedValue({
        id: orderId,
        userId,
        status: expectedOrderStatus,
      });

      deliveryRepository.findById.mockResolvedValue({
        id: deliveryId,
        orderId,
        driverId,
        status: initialDeliveryStatus,
      });
    });

    it('updates delivery and order using the same transaction', async () => {
      const updated = {
        id: deliveryId,
        orderId,
        driverId,
        status: nextDeliveryStatus,
        deliveredAt: operation === 'complete' ? deliveredAt : null,
      };

      writeDelivery().mockResolvedValue(updated);

      await expect(execute()).resolves.toBe(updated);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(deliveryRepository.findById).toHaveBeenCalledWith(
        deliveryId,
        transactionClient
      );

      expect(orderRepository.findById).toHaveBeenCalledWith(
        orderId,
        transactionClient
      );

      expect(writeDelivery()).toHaveBeenCalledWith(
        deliveryId,
        driverId,
        transactionClient
      );

      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        orderId,
        expectedOrderStatus,
        nextOrderStatus,
        transactionClient
      );

      if (operation === 'pickup') {
        expect(outboxRepository.create).not.toHaveBeenCalled();
      } else {
        expect(outboxRepository.create).toHaveBeenCalledTimes(1);

        expect(outboxRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: DELIVERY_COMPLETED_EVENT,
          }),
          transactionClient
        );
      }
    });

    it('rejects a missing delivery without writes or outbox events', async () => {
      deliveryRepository.findById.mockResolvedValue(null);

      await expect(execute()).rejects.toThrow(DeliveryNotFoundError);

      expect(orderRepository.findById).not.toHaveBeenCalled();
      expect(writeDelivery()).not.toHaveBeenCalled();
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(outboxRepository.create).not.toHaveBeenCalled();
    });

    it.each(['another-driver', null])(
      'rejects delivery assigned to %s without writes or outbox events',
      async (assignedDriverId) => {
        deliveryRepository.findById.mockResolvedValue({
          id: deliveryId,
          orderId,
          driverId: assignedDriverId,
          status: initialDeliveryStatus,
        });

        await expect(execute()).rejects.toThrow(ForbiddenDeliveryAccessError);

        expect(orderRepository.findById).not.toHaveBeenCalled();
        expect(writeDelivery()).not.toHaveBeenCalled();
        expect(orderRepository.updateStatus).not.toHaveBeenCalled();
        expect(outboxRepository.create).not.toHaveBeenCalled();
      }
    );

    it('rejects a missing order without writes or outbox events', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(execute()).rejects.toThrow(OrderNotFoundError);

      expect(writeDelivery()).not.toHaveBeenCalled();
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(outboxRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a repeated operation without writes or outbox events', async () => {
      orderRepository.findById.mockResolvedValue({
        id: orderId,
        userId,
        status: nextOrderStatus,
      });

      const expectedError =
        operation === 'pickup'
          ? OrderNotReadyForDeliveryError
          : OrderStateConflictError;

      await expect(execute()).rejects.toThrow(expectedError);

      expect(writeDelivery()).not.toHaveBeenCalled();
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(outboxRepository.create).not.toHaveBeenCalled();
    });

    it('does not update order or save an event when delivery update fails', async () => {
      const error = new DeliveryStateConflictError(deliveryId);

      writeDelivery().mockRejectedValue(error);

      await expect(execute()).rejects.toBe(error);

      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(outboxRepository.create).not.toHaveBeenCalled();
      expect(transactionCompleted).toBe(false);
    });

    it('rejects the transaction callback when order update fails', async () => {
      const error = new OrderStateConflictError(orderId, expectedOrderStatus);

      writeDelivery().mockResolvedValue({
        id: deliveryId,
        orderId,
        driverId,
        status: nextDeliveryStatus,
        deliveredAt: operation === 'complete' ? deliveredAt : null,
      });

      orderRepository.updateStatus.mockRejectedValue(error);

      await expect(execute()).rejects.toBe(error);

      expect(writeDelivery()).toHaveBeenCalledWith(
        deliveryId,
        driverId,
        transactionClient
      );

      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        orderId,
        expectedOrderStatus,
        nextOrderStatus,
        transactionClient
      );

      expect(outboxRepository.create).not.toHaveBeenCalled();
      expect(transactionCompleted).toBe(false);
    });
  });

  describe('DeliveryCompleted outbox event', () => {
    beforeEach(() => {
      orderRepository.findById.mockResolvedValue({
        id: orderId,
        userId,
        status: OrderStatus.OUT_FOR_DELIVERY,
      });

      deliveryRepository.findById.mockResolvedValue({
        id: deliveryId,
        orderId,
        driverId,
        status: DeliveryStatus.PICKED_UP,
      });

      deliveryRepository.markDelivered.mockResolvedValue({
        id: deliveryId,
        orderId,
        driverId,
        status: DeliveryStatus.DELIVERED,
        deliveredAt,
      });
    });

    it('saves one event with trusted data inside the same transaction', async () => {
      outboxRepository.create.mockImplementation(
        async (data: CreateOutboxEventData, tx: typeof transactionClient) => {
          expect(transactionCompleted).toBe(false);
          expect(tx).toBe(transactionClient);

          expect(data.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          );

          expect(data).toEqual({
            id: data.id,
            type: DELIVERY_COMPLETED_EVENT,
            payload: {
              eventId: data.id,
              deliveryId,
              orderId,
              userId,
              occurredAt: deliveredAt.toISOString(),
            },
            occurredAt: deliveredAt,
          });
        }
      );

      await completeDelivery.execute(deliveryId, driverId);

      expect(outboxRepository.create).toHaveBeenCalledTimes(1);
      expect(transactionCompleted).toBe(true);
    });

    it('rejects the transaction callback when saving the outbox event fails', async () => {
      const error = new Error('Outbox write failed');

      outboxRepository.create.mockRejectedValue(error);

      await expect(completeDelivery.execute(deliveryId, driverId)).rejects.toBe(
        error
      );

      expect(deliveryRepository.markDelivered).toHaveBeenCalledWith(
        deliveryId,
        driverId,
        transactionClient
      );

      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        transactionClient
      );

      expect(outboxRepository.create).toHaveBeenCalledTimes(1);
      expect(transactionCompleted).toBe(false);
    });

    it('propagates a commit failure after the outbox write was attempted', async () => {
      const commitFailure = new Error('Simulated commit failure');

      prisma.$transaction.mockImplementationOnce(
        async (
          callback: (tx: typeof transactionClient) => Promise<unknown>
        ) => {
          await callback(transactionClient);

          throw commitFailure;
        }
      );

      await expect(completeDelivery.execute(deliveryId, driverId)).rejects.toBe(
        commitFailure
      );

      expect(deliveryRepository.markDelivered).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalled();

      expect(outboxRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DELIVERY_COMPLETED_EVENT,
        }),
        transactionClient
      );

      expect(transactionCompleted).toBe(false);
    });

    it('rejects a missing deliveredAt without saving an outbox event', async () => {
      deliveryRepository.markDelivered.mockResolvedValue({
        id: deliveryId,
        orderId,
        driverId,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: null,
      });

      await expect(
        completeDelivery.execute(deliveryId, driverId)
      ).rejects.toThrow('Completed delivery is missing deliveredAt');

      expect(outboxRepository.create).not.toHaveBeenCalled();
      expect(transactionCompleted).toBe(false);
    });
  });
});

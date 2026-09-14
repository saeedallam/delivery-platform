import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { NotificationType } from './contracts/notification-type.enum';
import { NotificationNotFoundError } from './errors/notification-not-found.error';
import { NotificationRepository } from './notification.repository';
import { NotificationsService } from './notifications.service';

describe('Mark notification as read', () => {
  const notificationId = '7a174e35-a43f-4fb6-b69c-0e628fe7a674';
  const ownerId = '782124bb-be6f-453f-884d-dcbb3f33157f';
  const anotherUserId = '7aa88c32-694f-419b-b582-693282d6d9af';

  const firstReadAt = new Date('2026-09-14T00:36:26.924Z');

  const notification = {
    id: notificationId,
    eventId: '9e127550-4f84-4da9-aba8-702fe7596e69',
    userId: ownerId,
    orderId: '049467aa-3383-4870-8f48-772930df91ea',
    type: NotificationType.DELIVERY_COMPLETED,
    title: 'Your order has been delivered',
    body: 'Your order has been delivered successfully.',
    readAt: firstReadAt,
    occurredAt: new Date('2026-09-12T20:47:51.467Z'),
    createdAt: new Date('2026-09-12T20:47:51.509Z'),
  };

  let service: NotificationsService;

  let prisma: {
    notification: {
      updateMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        NotificationRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  it('updates only an unread notification belonging to the user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue({
      ...notification,
    });

    const result = await service.markAsRead(notificationId, ownerId);

    expect(prisma.notification.updateMany).toHaveBeenCalledTimes(1);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId: ownerId,
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId: ownerId,
      },
    });

    expect(result).toEqual(notification);
  });

  it('returns an already-read notification when no row was updated', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue({
      ...notification,
    });

    const result = await service.markAsRead(notificationId, ownerId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId: ownerId,
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });

    expect(result.readAt).toEqual(firstReadAt);
  });

  it('throws NotificationNotFoundError when no notification is found', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markAsRead(notificationId, ownerId)).rejects.toThrow(
      NotificationNotFoundError
    );
  });

  it('scopes both queries to the requesting user and rejects a missing result', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead(notificationId, anotherUserId)
    ).rejects.toThrow(NotificationNotFoundError);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId: anotherUserId,
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId: anotherUserId,
      },
    });
  });

  it('propagates an update failure without reading a success result', async () => {
    const databaseError = new Error('Database operation failed');

    prisma.notification.updateMany.mockRejectedValue(databaseError);

    await expect(service.markAsRead(notificationId, ownerId)).rejects.toBe(
      databaseError
    );

    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
  });
});

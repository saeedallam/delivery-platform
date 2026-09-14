import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateNotificationData } from './contracts/create-notification-data.interface';
import { NotificationType } from './contracts/notification-type.enum';
import { Notification } from './domain/notification.interface';
import { NotificationMappingError } from './errors/notification-mapping.error';

interface NotificationPersistenceRecord {
  id: string;
  eventId: string;
  userId: string;
  orderId: string;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  occurredAt: Date;
  createdAt: Date;
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOnce(data: CreateNotificationData): Promise<Notification> {
    const notification = await this.prisma.notification.upsert({
      where: {
        eventId: data.eventId,
      },
      create: {
        eventId: data.eventId,
        userId: data.userId,
        orderId: data.orderId,
        type: data.type,
        title: data.title,
        body: data.body,
        occurredAt: data.occurredAt,
      },
      update: {},
    });

    return this.mapToNotification(notification);
  }

  async findByUserId(userId: string): Promise<Notification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });

    return notifications.map((notification) =>
      this.mapToNotification(notification)
    );
  }

  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<Notification | null> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    return notification ? this.mapToNotification(notification) : null;
  }

  private mapToNotification(
    notification: NotificationPersistenceRecord
  ): Notification {
    const type = Object.values(NotificationType).find(
      (value) => value === notification.type
    );

    if (!type) {
      throw new NotificationMappingError(notification.type);
    }

    return {
      id: notification.id,
      eventId: notification.eventId,
      userId: notification.userId,
      orderId: notification.orderId,
      type,
      title: notification.title,
      body: notification.body,
      readAt: notification.readAt,
      occurredAt: notification.occurredAt,
      createdAt: notification.createdAt,
    };
  }
}

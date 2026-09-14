import { Injectable } from '@nestjs/common';

import type { DeliveryCompletedEvent } from '../deliveries/contracts/delivery-completed-event.interface';

import { NotificationType } from './contracts/notification-type.enum';
import type { Notification } from './domain/notification.interface';
import { NotificationRepository } from './notification.repository';
import { NotificationNotFoundError } from './errors/notification-not-found.error';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationRepository: NotificationRepository
  ) {}

  async notifyDeliveryCompleted(
    event: DeliveryCompletedEvent
  ): Promise<Notification> {
    return this.notificationRepository.createOnce({
      eventId: event.eventId,
      userId: event.userId,
      orderId: event.orderId,
      type: NotificationType.DELIVERY_COMPLETED,
      title: 'Your order has been delivered',
      body: `Your order ${event.orderId} has been delivered successfully.`,
      occurredAt: event.occurredAt,
    });
  }

  async getMyNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepository.findByUserId(userId);
  }

  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<Notification> {
    const notification = await this.notificationRepository.markAsRead(
      notificationId,
      userId
    );

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    return notification;
  }
}

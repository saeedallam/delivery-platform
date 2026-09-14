import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { DELIVERY_COMPLETED_EVENT } from '../deliveries/contracts/delivery-completed-event.interface';
import type { DeliveryCompletedEvent } from '../deliveries/contracts/delivery-completed-event.interface';

import { NotificationsService } from './notifications.service';

@Injectable()
export class DeliveryCompletedListener {
  private readonly logger = new Logger(DeliveryCompletedListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(DELIVERY_COMPLETED_EVENT, {
    suppressErrors: false,
  })
  async handle(event: DeliveryCompletedEvent): Promise<void> {
    const notification =
      await this.notificationsService.notifyDeliveryCompleted(event);

    this.logger.log(
      `Notification saved: notificationId=${notification.id}, eventId=${event.eventId}`
    );
  }
}

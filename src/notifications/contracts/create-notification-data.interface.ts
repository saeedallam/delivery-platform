import { NotificationType } from './notification-type.enum';

export interface CreateNotificationData {
  eventId: string;
  userId: string;
  orderId: string;
  type: NotificationType;
  title: string;
  body: string;
  occurredAt: Date;
}

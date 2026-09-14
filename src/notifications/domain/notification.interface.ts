import { NotificationType } from '../contracts/notification-type.enum';

export interface Notification {
  id: string;
  eventId: string;
  userId: string;
  orderId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: Date | null;
  occurredAt: Date;
  createdAt: Date;
}

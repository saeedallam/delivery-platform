export const DELIVERY_COMPLETED_EVENT = 'delivery.completed';

export interface DeliveryCompletedEvent {
  eventId: string;
  deliveryId: string;
  orderId: string;
  userId: string;
  occurredAt: Date;
}

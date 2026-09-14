import { DELIVERY_COMPLETED_EVENT } from '../../deliveries/contracts/delivery-completed-event.interface';
import type { DeliveryCompletedEvent } from '../../deliveries/contracts/delivery-completed-event.interface';

import type { OutboxEventRecord } from '../contracts/outbox-event-record.interface';
import { InvalidOutboxEventError } from '../errors/invalid-outbox-event.error';

export function mapDeliveryCompletedEvent(
  record: OutboxEventRecord
): DeliveryCompletedEvent {
  if (record.type !== DELIVERY_COMPLETED_EVENT) {
    throw new InvalidOutboxEventError(record.id, 'Unsupported event type');
  }

  const payload = record.payload;

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new InvalidOutboxEventError(record.id, 'Payload must be an object');
  }

  if (
    !('eventId' in payload) ||
    typeof payload.eventId !== 'string' ||
    payload.eventId !== record.id
  ) {
    throw new InvalidOutboxEventError(
      record.id,
      'Payload eventId must match the outbox id'
    );
  }

  if (
    !('deliveryId' in payload) ||
    typeof payload.deliveryId !== 'string' ||
    payload.deliveryId.trim().length === 0
  ) {
    throw new InvalidOutboxEventError(
      record.id,
      'deliveryId must be a non-empty string'
    );
  }

  if (
    !('orderId' in payload) ||
    typeof payload.orderId !== 'string' ||
    payload.orderId.trim().length === 0
  ) {
    throw new InvalidOutboxEventError(
      record.id,
      'orderId must be a non-empty string'
    );
  }

  if (
    !('userId' in payload) ||
    typeof payload.userId !== 'string' ||
    payload.userId.trim().length === 0
  ) {
    throw new InvalidOutboxEventError(
      record.id,
      'userId must be a non-empty string'
    );
  }

  if (!('occurredAt' in payload) || typeof payload.occurredAt !== 'string') {
    throw new InvalidOutboxEventError(
      record.id,
      'occurredAt must be a date string'
    );
  }

  const occurredAt = new Date(payload.occurredAt);

  if (
    Number.isNaN(occurredAt.getTime()) ||
    occurredAt.toISOString() !== payload.occurredAt
  ) {
    throw new InvalidOutboxEventError(
      record.id,
      'occurredAt must be a valid ISO date'
    );
  }

  if (occurredAt.getTime() !== record.occurredAt.getTime()) {
    throw new InvalidOutboxEventError(
      record.id,
      'Payload occurredAt must match the outbox occurredAt'
    );
  }

  return {
    eventId: payload.eventId,
    deliveryId: payload.deliveryId,
    orderId: payload.orderId,
    userId: payload.userId,
    occurredAt,
  };
}

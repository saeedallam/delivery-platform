import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DELIVERY_COMPLETED_EVENT } from '../deliveries/contracts/delivery-completed-event.interface';

import type { OutboxEventRecord } from './contracts/outbox-event-record.interface';
import { mapDeliveryCompletedEvent } from './mappers/map-delivery-completed-event';

@Injectable()
export class OutboxPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(record: OutboxEventRecord): Promise<void> {
    const event = mapDeliveryCompletedEvent(record);

    if (!this.eventEmitter.hasListeners(DELIVERY_COMPLETED_EVENT)) {
      throw new Error(`No listener registered for ${DELIVERY_COMPLETED_EVENT}`);
    }

    await this.eventEmitter.emitAsync(DELIVERY_COMPLETED_EVENT, event);
  }
}

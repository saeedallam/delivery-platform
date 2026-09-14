import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client';

import type { CreateOutboxEventData } from './contracts/create-outbox-event-data.interface';
import { OutboxEventRecord } from './contracts/outbox-event-record.interface';

@Injectable()
export class OutboxRepository {
  async create(
    data: CreateOutboxEventData,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: data.id,
        type: data.type,
        payload: data.payload,
        occurredAt: data.occurredAt,
      },
    });
  }

  async markPublished(
    eventId: string,
    tx: Prisma.TransactionClient
  ): Promise<boolean> {
    const result = await tx.outboxEvent.updateMany({
      where: {
        id: eventId,
        publishedAt: null,
      },
      data: {
        publishedAt: new Date(),
        lastError: null,
      },
    });

    return result.count === 1;
  }

  async lockNextReadyEvent(
    tx: Prisma.TransactionClient
  ): Promise<OutboxEventRecord | null> {
    const events = await tx.$queryRaw<OutboxEventRecord[]>`
    SELECT
      "id",
      "type",
      "payload",
      "occurredAt",
      "attempts"
    FROM "outbox_events"
    WHERE
      "publishedAt" IS NULL
      AND "availableAt" <= CURRENT_TIMESTAMP
    ORDER BY
      "createdAt" ASC,
      "id" ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  `;

    return events[0] ?? null;
  }

  async scheduleRetry(
    eventId: string,
    availableAt: Date,
    lastError: string,
    tx: Prisma.TransactionClient
  ): Promise<boolean> {
    const result = await tx.outboxEvent.updateMany({
      where: {
        id: eventId,
        publishedAt: null,
      },
      data: {
        availableAt,
        lastError,
      },
    });

    return result.count === 1;
  }

  async incrementAttempts(
    eventId: string,
    tx: Prisma.TransactionClient
  ): Promise<boolean> {
    const result = await tx.outboxEvent.updateMany({
      where: {
        id: eventId,
        publishedAt: null,
      },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    return result.count === 1;
  }
}

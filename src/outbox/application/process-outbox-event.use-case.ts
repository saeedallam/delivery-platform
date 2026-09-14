import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { OutboxRepository } from '../outbox.repository';
import { OutboxPublisher } from '../outbox.publisher';

@Injectable()
export class ProcessOutboxEventUseCase {
  private readonly logger = new Logger(ProcessOutboxEventUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: OutboxRepository,
    private readonly outboxPublisher: OutboxPublisher
  ) {}

  async execute(): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const event = await this.outboxRepository.lockNextReadyEvent(tx);

      if (!event) {
        return false;
      }

      const incremented = await this.outboxRepository.incrementAttempts(
        event.id,
        tx
      );

      if (!incremented) {
        throw new Error(`Could not start outbox attempt for ${event.id}`);
      }

      try {
        await this.outboxPublisher.publish(event);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown publishing error';

        const attempt = event.attempts + 1;

        const delayMs = Math.min(1_000 * 2 ** Math.min(attempt - 1, 6), 60_000);

        const scheduled = await this.outboxRepository.scheduleRetry(
          event.id,
          new Date(Date.now() + delayMs),
          message,
          tx
        );

        if (!scheduled) {
          throw new Error(`Could not schedule outbox retry for ${event.id}`);
        }

        this.logger.warn(
          `Outbox event ${event.id} failed on attempt ${attempt}: ${message}`
        );

        return true;
      }

      const published = await this.outboxRepository.markPublished(event.id, tx);

      if (!published) {
        throw new Error(`Could not mark outbox event ${event.id} as published`);
      }

      return true;
    });
  }
}

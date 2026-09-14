import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { ProcessOutboxEventUseCase } from './application/process-outbox-event.use-case';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxRepository } from './outbox.repository';
import { OutboxWorker } from './outbox.worker';

@Module({
  imports: [PrismaModule],
  providers: [
    OutboxRepository,
    OutboxPublisher,
    ProcessOutboxEventUseCase,
    OutboxWorker,
  ],
  exports: [OutboxRepository],
})
export class OutboxModule {}

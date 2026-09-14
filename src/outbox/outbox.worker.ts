import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';

import { EventEmitterReadinessWatcher } from '@nestjs/event-emitter';

import { ProcessOutboxEventUseCase } from './application/process-outbox-event.use-case';

@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private currentRun: Promise<void> | undefined;
  private stopping = false;

  constructor(
    private readonly processOutboxEvent: ProcessOutboxEventUseCase,
    private readonly eventEmitterReadinessWatcher: EventEmitterReadinessWatcher
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.eventEmitterReadinessWatcher.waitUntilReady();

    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.stopping) {
      return;
    }

    this.timer = setTimeout(() => {
      this.currentRun = this.runOnce();
    }, 1_000);
  }

  private async runOnce(): Promise<void> {
    try {
      await this.processOutboxEvent.execute();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message, error.stack);
      } else {
        this.logger.error('Unknown outbox worker error');
      }
    } finally {
      this.scheduleNext();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }

    await this.currentRun;
  }
}

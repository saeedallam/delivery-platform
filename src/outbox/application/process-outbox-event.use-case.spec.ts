import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { DELIVERY_COMPLETED_EVENT } from '../../deliveries/contracts/delivery-completed-event.interface';

import { OutboxRepository } from '../outbox.repository';
import { OutboxPublisher } from '../outbox.publisher';

import { ProcessOutboxEventUseCase } from './process-outbox-event.use-case';

describe('ProcessOutboxEventUseCase', () => {
  const transactionClient = {};
  const now = new Date('2026-09-14T12:00:00.000Z');

  const event = {
    id: 'event-1',
    type: DELIVERY_COMPLETED_EVENT,
    payload: {
      eventId: 'event-1',
      deliveryId: 'delivery-1',
      orderId: 'order-1',
      userId: 'user-1',
      occurredAt: '2026-09-14T11:00:00.000Z',
    },
    occurredAt: new Date('2026-09-14T11:00:00.000Z'),
    attempts: 0,
  };

  let useCase: ProcessOutboxEventUseCase;
  let transactionCompleted: boolean;

  let prisma: {
    $transaction: jest.Mock;
  };

  let repository: {
    lockNextReadyEvent: jest.Mock;
    incrementAttempts: jest.Mock;
    scheduleRetry: jest.Mock;
    markPublished: jest.Mock;
  };

  let publisher: {
    publish: jest.Mock;
  };

  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    transactionCompleted = false;

    prisma = {
      $transaction: jest.fn(
        async (
          callback: (tx: typeof transactionClient) => Promise<unknown>
        ) => {
          const result = await callback(transactionClient);
          transactionCompleted = true;
          return result;
        }
      ),
    };

    repository = {
      lockNextReadyEvent: jest.fn().mockResolvedValue(event),
      incrementAttempts: jest.fn().mockResolvedValue(true),
      scheduleRetry: jest.fn().mockResolvedValue(true),
      markPublished: jest.fn().mockResolvedValue(true),
    };

    publisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcessOutboxEventUseCase,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: OutboxRepository,
          useValue: repository,
        },
        {
          provide: OutboxPublisher,
          useValue: publisher,
        },
      ],
    }).compile();

    useCase = moduleRef.get(ProcessOutboxEventUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false without publishing when no event is ready', async () => {
    repository.lockNextReadyEvent.mockResolvedValue(null);

    await expect(useCase.execute()).resolves.toBe(false);

    expect(repository.lockNextReadyEvent).toHaveBeenCalledWith(
      transactionClient
    );

    expect(repository.incrementAttempts).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(repository.scheduleRetry).not.toHaveBeenCalled();
  });

  it('publishes the event and records success using the same transaction', async () => {
    publisher.publish.mockImplementation(async () => {
      expect(transactionCompleted).toBe(false);

      expect(repository.incrementAttempts).toHaveBeenCalledWith(
        event.id,
        transactionClient
      );

      expect(repository.markPublished).not.toHaveBeenCalled();
    });

    await expect(useCase.execute()).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(repository.lockNextReadyEvent).toHaveBeenCalledWith(
      transactionClient
    );

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(event);

    expect(repository.markPublished).toHaveBeenCalledWith(
      event.id,
      transactionClient
    );

    expect(repository.scheduleRetry).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(true);
  });

  it('waits for publishing to finish before recording success', async () => {
    let finishPublishing!: () => void;
    let notifyStarted!: () => void;

    const publishingStarted = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });

    const publishingFinished = new Promise<void>((resolve) => {
      finishPublishing = resolve;
    });

    publisher.publish.mockImplementation(() => {
      notifyStarted();
      return publishingFinished;
    });

    const execution = useCase.execute();

    await publishingStarted;

    try {
      expect(repository.markPublished).not.toHaveBeenCalled();
      expect(transactionCompleted).toBe(false);
    } finally {
      finishPublishing();
      await execution;
    }

    expect(repository.markPublished).toHaveBeenCalledWith(
      event.id,
      transactionClient
    );

    expect(transactionCompleted).toBe(true);
  });

  it.each([
    [0, 1_000],
    [1, 2_000],
    [2, 4_000],
    [5, 32_000],
    [6, 60_000],
    [20, 60_000],
  ])(
    'schedules a retry after %i previous attempts with a delay of %i ms',
    async (attempts, delayMs) => {
      repository.lockNextReadyEvent.mockResolvedValue({
        ...event,
        attempts,
      });

      publisher.publish.mockRejectedValue(
        new Error('Notification write failed')
      );

      await expect(useCase.execute()).resolves.toBe(true);

      expect(repository.scheduleRetry).toHaveBeenCalledWith(
        event.id,
        new Date(now.getTime() + delayMs),
        'Notification write failed',
        transactionClient
      );

      expect(repository.markPublished).not.toHaveBeenCalled();
      expect(transactionCompleted).toBe(true);
    }
  );

  it('records a fallback message for a non-Error publishing failure', async () => {
    publisher.publish.mockRejectedValue('Unexpected failure');

    await expect(useCase.execute()).resolves.toBe(true);

    expect(repository.scheduleRetry).toHaveBeenCalledWith(
      event.id,
      new Date(now.getTime() + 1_000),
      'Unknown publishing error',
      transactionClient
    );

    expect(repository.markPublished).not.toHaveBeenCalled();
  });

  it('rejects without publishing when the attempt cannot be recorded', async () => {
    repository.incrementAttempts.mockResolvedValue(false);

    await expect(useCase.execute()).rejects.toThrow(
      `Could not start outbox attempt for ${event.id}`
    );

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(repository.scheduleRetry).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(false);
  });

  it('rejects when retry scheduling returns false', async () => {
    publisher.publish.mockRejectedValue(new Error('Publishing failed'));
    repository.scheduleRetry.mockResolvedValue(false);

    await expect(useCase.execute()).rejects.toThrow(
      `Could not schedule outbox retry for ${event.id}`
    );

    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(false);
  });

  it('propagates a database failure while scheduling a retry', async () => {
    const databaseError = new Error('Retry update failed');

    publisher.publish.mockRejectedValue(new Error('Publishing failed'));
    repository.scheduleRetry.mockRejectedValue(databaseError);

    await expect(useCase.execute()).rejects.toBe(databaseError);

    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(false);
  });

  it('rejects when publication success cannot be recorded', async () => {
    repository.markPublished.mockResolvedValue(false);

    await expect(useCase.execute()).rejects.toThrow(
      `Could not mark outbox event ${event.id} as published`
    );

    expect(publisher.publish).toHaveBeenCalledWith(event);
    expect(repository.scheduleRetry).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(false);
  });

  it('propagates a database failure after successful publishing', async () => {
    const databaseError = new Error('Publication update failed');

    repository.markPublished.mockRejectedValue(databaseError);

    await expect(useCase.execute()).rejects.toBe(databaseError);

    expect(publisher.publish).toHaveBeenCalledWith(event);
    expect(repository.scheduleRetry).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(false);
  });

  it('propagates a failure while selecting the event', async () => {
    const databaseError = new Error('Could not lock event');

    repository.lockNextReadyEvent.mockRejectedValue(databaseError);

    await expect(useCase.execute()).rejects.toBe(databaseError);

    expect(repository.incrementAttempts).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(repository.scheduleRetry).not.toHaveBeenCalled();
    expect(transactionCompleted).toBe(false);
  });

  it('propagates a commit failure after successful processing', async () => {
    const commitError = new Error('Commit failed');

    prisma.$transaction.mockImplementationOnce(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) => {
        await callback(transactionClient);
        throw commitError;
      }
    );

    await expect(useCase.execute()).rejects.toBe(commitError);

    expect(publisher.publish).toHaveBeenCalledWith(event);

    expect(repository.markPublished).toHaveBeenCalledWith(
      event.id,
      transactionClient
    );

    expect(transactionCompleted).toBe(false);
  });
});

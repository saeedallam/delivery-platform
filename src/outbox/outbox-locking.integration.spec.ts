import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

import { DELIVERY_COMPLETED_EVENT } from '../deliveries/contracts/delivery-completed-event.interface';

import { OutboxRepository } from './outbox.repository';

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Outbox PostgreSQL locking', () => {
  const firstId = randomUUID();
  const secondId = randomUUID();

  let prisma: PrismaService | undefined;
  let repository: OutboxRepository;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    const databaseName = new URL(databaseUrl).pathname;

    if (databaseName !== '/delivery_test_db') {
      throw new Error('This integration test must use delivery_test_db');
    }

    prisma = new PrismaService();
    repository = new OutboxRepository();

    await prisma.$connect();

    const pendingEvents = await prisma.outboxEvent.count({
      where: {
        publishedAt: null,
      },
    });

    if (pendingEvents !== 0) {
      throw new Error(
        'The test database contains pending outbox events. ' +
          'Inspect them before running this test.'
      );
    }

    await prisma.outboxEvent.createMany({
      data: [
        {
          id: firstId,
          type: DELIVERY_COMPLETED_EVENT,
          payload: {
            eventId: firstId,
          },
          occurredAt: new Date('2020-01-01T00:00:00.000Z'),
          createdAt: new Date('2020-01-01T00:00:00.000Z'),
          availableAt: new Date('2020-01-01T00:00:00.000Z'),
        },
        {
          id: secondId,
          type: DELIVERY_COMPLETED_EVENT,
          payload: {
            eventId: secondId,
          },
          occurredAt: new Date('2020-01-02T00:00:00.000Z'),
          createdAt: new Date('2020-01-02T00:00:00.000Z'),
          availableAt: new Date('2020-01-02T00:00:00.000Z'),
        },
      ],
    });
  }, 30_000);

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    try {
      await prisma.outboxEvent.deleteMany({
        where: {
          id: {
            in: [firstId, secondId],
          },
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  it('skips a locked event and makes it available again after rollback', async () => {
    if (!prisma) {
      throw new Error('Test database was not initialized');
    }

    const client = prisma;
    const rollbackError = new Error('Intentional rollback');

    await expect(
      client.$transaction(
        async (firstTx) => {
          const firstEvent = await repository.lockNextReadyEvent(firstTx);

          expect(firstEvent?.id).toBe(firstId);

          // A separate transaction runs while the first lock is held.
          await client.$transaction(
            async (secondTx) => {
              const secondEvent = await repository.lockNextReadyEvent(secondTx);

              expect(secondEvent?.id).toBe(secondId);
            },
            {
              maxWait: 5_000,
              timeout: 5_000,
            }
          );

          const incremented = await repository.incrementAttempts(
            firstId,
            firstTx
          );

          const published = await repository.markPublished(firstId, firstTx);

          expect(incremented).toBe(true);
          expect(published).toBe(true);

          // Roll back the updates and release the first event's lock.
          throw rollbackError;
        },
        {
          maxWait: 5_000,
          timeout: 15_000,
        }
      )
    ).rejects.toBe(rollbackError);

    const storedEvent = await client.outboxEvent.findUnique({
      where: {
        id: firstId,
      },
    });

    expect(storedEvent).not.toBeNull();
    expect(storedEvent?.attempts).toBe(0);
    expect(storedEvent?.publishedAt).toBeNull();

    await client.$transaction(async (tx) => {
      const availableAgain = await repository.lockNextReadyEvent(tx);

      expect(availableAgain?.id).toBe(firstId);
    });
  }, 30_000);
});

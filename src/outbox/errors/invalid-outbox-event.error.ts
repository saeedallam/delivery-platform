export class InvalidOutboxEventError extends Error {
  constructor(eventId: string, reason: string) {
    super(`Invalid outbox event ${eventId}: ${reason}`);
    this.name = 'InvalidOutboxEventError';
  }
}

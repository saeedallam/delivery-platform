export class InvalidPaymentWebhookError extends Error {
  constructor(cause?: unknown) {
    super('Invalid payment webhook', { cause });

    this.name = 'InvalidPaymentWebhookError';
  }
}

import { PaymentStatus } from '../contracts/payment-status.enum';

export class PaymentStateConflictError extends Error {
  constructor(paymentId: string, expectedStatus: PaymentStatus) {
    super(
      `Payment ${paymentId} is no longer in the expected ${expectedStatus} state`
    );

    this.name = 'PaymentStateConflictError';
  }
}

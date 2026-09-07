import { PaymentStatus } from '../contracts/payment-status.enum';

export class PaymentCheckoutNotAllowedError extends Error {
  constructor(paymentId: string, currentStatus: PaymentStatus) {
    super(
      `Checkout cannot be started for payment ${paymentId} while its status is ${currentStatus}`
    );

    this.name = 'PaymentCheckoutNotAllowedError';
  }
}

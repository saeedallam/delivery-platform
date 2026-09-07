export class PaymentStateConflictError extends Error {
  constructor(paymentId: string) {
    super(
      `Payment ${paymentId} cannot be updated because its state or provider data does not match`
    );

    this.name = 'PaymentStateConflictError';
  }
}

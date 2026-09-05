export class PaymentMappingError extends Error {
  constructor(status: string, currency: string) {
    super(
      `Failed to map payment persistence values. Status: ${status}, Currency: ${currency}`
    );

    this.name = 'PaymentMappingError';
  }
}

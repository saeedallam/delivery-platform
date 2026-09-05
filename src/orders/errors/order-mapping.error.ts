export class OrderMappingError extends Error {
  constructor(orderId: string, currency: string) {
    super(`Failed to map currency ${currency} for order ${orderId}`);

    this.name = 'OrderMappingError';
  }
}

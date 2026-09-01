export class InsufficientStockError extends Error {
  constructor(
    productId: string,
    requestedQuantity: number,
    availableQuantity: number
  ) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requestedQuantity}, Available: ${availableQuantity}`
    );
    this.name = 'InsufficientStockError';
  }
}

export class InventoryReleaseConflictError extends Error {
  constructor(
    productId: string,
    requestedQuantity: number,
    reservedQuantity: number
  ) {
    super(
      `Cannot release ${requestedQuantity} units for product ${productId}. Currently reserved: ${reservedQuantity}`
    );

    this.name = 'InventoryReleaseConflictError';
  }
}

export class InventoryNotFoundError extends Error {
  constructor(productId: string) {
    super(`Inventory for product ${productId} was not found`);
    this.name = 'InventoryNotFoundError';
  }
}

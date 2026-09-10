export class DeliveryStateConflictError extends Error {
  constructor(deliveryId: string) {
    super(`Delivery ${deliveryId} is no longer in the expected state`);
    this.name = 'DeliveryStateConflictError';
  }
}

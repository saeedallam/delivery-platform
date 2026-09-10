export class DeliveryNotFoundError extends Error {
  constructor(deliveryId: string) {
    super(`Delivery ${deliveryId} not found`);
    this.name = 'DeliveryNotFoundError';
  }
}

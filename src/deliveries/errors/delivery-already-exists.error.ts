export class DeliveryAlreadyExistsError extends Error {
  constructor(orderId: string) {
    super(`Delivery already exists for order ${orderId}`);
    this.name = 'DeliveryAlreadyExistsError';
  }
}

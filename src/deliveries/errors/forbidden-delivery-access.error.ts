export class ForbiddenDeliveryAccessError extends Error {
  constructor(deliveryId: string) {
    super(`You are not allowed to access delivery ${deliveryId}`);
    this.name = 'ForbiddenDeliveryAccessError';
  }
}

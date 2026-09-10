export class OrderNotReadyForDeliveryError extends Error {
  constructor(orderId: string, currentStatus: string) {
    super(
      `Order ${orderId} is not ready for delivery. Current status: ${currentStatus}`
    );

    this.name = 'OrderNotReadyForDeliveryError';
  }
}

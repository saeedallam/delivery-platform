export class OrderNotPayableError extends Error {
  constructor(orderId: string, currentStatus: string) {
    super(
      `Order ${orderId} cannot be paid while its status is ${currentStatus}`
    );

    this.name = 'OrderNotPayableError';
  }
}
